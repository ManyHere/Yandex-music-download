document.addEventListener('DOMContentLoaded', () => {
  const tokenInput = document.getElementById('tokenInput');
  const keyIcon = document.querySelector('.input-container i');
  const errorMessage = document.getElementById('errorMessage');
  const filenamePatternInput = document.getElementById('filenamePatternInput');
  const saveFilenameButton = document.getElementById('saveFilenameButton');
  const instructionsToggle = document.getElementById('instructionsToggle');
  const instructionsContent = document.getElementById('instructionsContent');
  const toggleIcon = document.getElementById('toggleIcon');
  const formatLinks = document.querySelectorAll('.format-link');

  if (!tokenInput || !keyIcon || !errorMessage || !filenamePatternInput || !saveFilenameButton || !instructionsToggle || !instructionsContent || !toggleIcon) {
    console.error('Один или несколько элементов DOM отсутствуют.');
    return;
  }

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
    setTimeout(() => {
      errorMessage.classList.remove('show');
    }, 5000);
  }

  function saveFilenamePattern(pattern) {
    if (!pattern || pattern.trim() === '') {
      showError('Формат имени файла не может быть пустым.');
      return;
    }
    chrome.storage.local.set({ filenamePattern: pattern }, () => {
      if (chrome.runtime.lastError) {
        showError('Не удалось сохранить формат. Попробуйте снова.');
        return;
      }
    });
  }

  function updateUI(token, filenamePattern) {
    tokenInput.value = token || '';
    tokenInput.readOnly = !!token;
    filenamePatternInput.value = filenamePattern || '{artist} - {title}';
  }

  chrome.storage.local.get(['yandexMusicToken', 'filenamePattern'], (result) => {
    if (chrome.runtime.lastError) {
      showError('Не удалось загрузить настройки. Попробуйте снова.');
      return;
    }
    updateUI(result.yandexMusicToken, result.filenamePattern);
  });

  saveFilenameButton.addEventListener('click', () => {
    const pattern = filenamePatternInput.value.trim();
    saveFilenamePattern(pattern);
  });

  formatLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const pattern = link.getAttribute('data-pattern');
      if (pattern) {
        filenamePatternInput.value = pattern;
        saveFilenamePattern(pattern);
      } else {
        showError('Не удалось получить формат из ссылки.');
      }
    });
  });

  instructionsToggle.addEventListener('click', () => {
    const isVisible = instructionsContent.classList.toggle('show');
    toggleIcon.className = isVisible ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'tokenUpdated' && request.token) {
      updateUI(request.token, filenamePatternInput.value);
    } else if (request.action === 'authFailed') {
      showError('Не удалось получить токен. Проверьте соединение и попробуйте снова.');
    }
  });

  keyIcon.addEventListener('click', () => {
    if (tokenInput.type === 'password') {
      tokenInput.type = 'text';
      keyIcon.classList.add('showing');
    } else {
      tokenInput.type = 'password';
      keyIcon.classList.remove('showing');
    }
  });
});