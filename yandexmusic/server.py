from flask import Flask, request, jsonify, Response, send_file
from flask_cors import CORS
from yandex_music import Client
import requests
import io
import re

app = Flask(__name__)
CORS(app, expose_headers=['Content-Disposition'])

@app.errorhandler(Exception)
def handle_exception(e):
    return jsonify({'error': 'Произошла ошибка на сервере. Пожалуйста, попробуйте позже.'}), 500

@app.route('/get_track_info', methods=['POST'])
def get_track_info():
    try:
        data = request.get_json()
        token = data.get('token')
        track_id = data.get('track_id')
        filename_pattern = data.get('filename_pattern', '{artist} - {title}')

        if not token or not track_id:
            return jsonify({'error': 'Токен или ID трека не указаны'}), 400

        try:
            client = Client(token=token)
            client.init()
        except Exception:
            return jsonify({'error': 'Недействительный токен авторизации'}), 401

        try:
            track = client.tracks([track_id])[0]
            download_info = track.get_download_info()
        except Exception:
            return jsonify({'error': 'Не удалось получить информацию о треке'}), 404

        available_formats = {}
        preferred_bitrates = [320, 192, 128]
        for info in download_info:
            if info.codec == 'mp3' and info.bitrate_in_kbps in preferred_bitrates:
                try:
                    direct_link = info.get_direct_link()
                    if direct_link:
                        response = requests.head(direct_link, headers={
                            'User-Agent': 'Mozilla/5.0'
                        }, allow_redirects=True)
                        if response.status_code == 200:
                            available_formats[info.bitrate_in_kbps] = direct_link
                except Exception:
                    continue

        if not available_formats:
            return jsonify({'error': 'Нет доступных mp3 форматов для этого трека'}), 404

        selected_bitrate = next((bitrate for bitrate in preferred_bitrates if bitrate in available_formats), None)
        if not selected_bitrate:
            return jsonify({'error': 'Нет доступных mp3 форматов в указанных битрейтах'}), 404

        artists = [artist.name for artist in track.artists] if track.artists else ["Неизвестный исполнитель"]
        artist_str = ", ".join(artists)
        title = track.title
        version = getattr(track, 'version', None)

        if version and version.lower() not in title.lower():
            title = f"{title} {version}"

        base_filename = filename_pattern.format(
            artist=artist_str,
            title=title,
            version=version or "",
            bitrate=selected_bitrate
        )
        base_filename = re.sub(r'[<>:"/\\|?*]', '', base_filename)
        base_filename = re.sub(r'\s+', ' ', base_filename).strip()
        main_filename = f"{base_filename}.mp3"

        urls = {str(bitrate): available_formats[bitrate] for bitrate in available_formats}
        filenames = {str(bitrate): filename_pattern.format(
            artist=artist_str,
            title=title,
            version=version or "",
            bitrate=bitrate
        ) + ".mp3" for bitrate in available_formats}
        filenames = {k: re.sub(r'[<>:"/\\|?*]', '', v) for k, v in filenames.items()}
        filenames = {k: re.sub(r'\s+', ' ', v).strip() for k, v in filenames.items()}

        response_data = {
            'url': available_formats[selected_bitrate],
            'filename': main_filename,
            'urls': urls,
            'filenames': filenames
        }

        return jsonify(response_data), 200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        }

    except Exception as e:
        return jsonify({'error': f'Ошибка обработки запроса: {str(e)}'}), 500

@app.route('/download_track', methods=['POST'])
def download_track():
    try:
        data = request.get_json()
        url = data.get('url')
        filename = data.get('filename')

        if not url or not filename:
            return jsonify({'error': 'URL или имя файла не указаны'}), 400

        try:
            response = requests.get(url, headers={
                'User-Agent': 'Mozilla/5.0'
            }, stream=True, timeout=30)
            if response.status_code != 200:
                return jsonify({'error': f'Не удалось скачать трек: {response.status_code}'}), 400
        except requests.exceptions.RequestException:
            return jsonify({'error': 'Ошибка сети при скачивании трека'}), 503

        file_stream = io.BytesIO()
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                file_stream.write(chunk)
        file_stream.seek(0)

        return send_file(
            file_stream,
            as_attachment=True,
            download_name=filename,
            mimetype='audio/mpeg'
        )

    except Exception as e:
        return jsonify({'error': f'Ошибка скачивания трека: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(host='localhost', port=5000)