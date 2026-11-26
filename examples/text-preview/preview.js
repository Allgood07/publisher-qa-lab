'use strict';
const key = 'publisher-qa-lab:text-preview:v1';
const form = document.querySelector('#entry');
if (form) {
  form.addEventListener('submit', event => {
    event.preventDefault();
    const field = document.querySelector('#message');
    if (!field.value.trim()) { field.setCustomValidity('Введите непустое сообщение.'); field.reportValidity(); return; }
    try { sessionStorage.setItem(key, field.value); }
    catch { document.querySelector('#notice').textContent = 'Браузер не разрешил сохранение в этой вкладке.'; return; }
    form.reset();
    location.assign('result.html');
  });
  form.addEventListener('input', () => document.querySelector('#message').setCustomValidity(''));
  form.querySelector('button').disabled = false;
} else {
  const output = document.querySelector('#output');
  const clear = document.querySelector('#clear');
  function render() {
    try {
      const message = sessionStorage.getItem(key);
      output.textContent = message ?? 'Пока нет сообщения.';
      clear.hidden = message === null;
    } catch { output.textContent = 'Хранилище вкладки недоступно.'; clear.hidden = true; }
  }
  clear.addEventListener('click', () => { sessionStorage.removeItem(key); render(); });
  window.addEventListener('pageshow', render);
  render();
}
