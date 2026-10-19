import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

function App() {
  return (
    <main>
      <header><span className="mark" aria-hidden="true">↗</span> Link Canvas</header>
      <section>
        <p className="eyebrow">НОВОЕ ПРОСТРАНСТВО</p>
        <h1>Здесь начинается<br />ваш следующий проект.</h1>
        <p className="description">Основа готова. Создавайте пространство для ссылок, идей и всего, что хочется сохранить.</p>
        <div className="status"><span aria-hidden="true" /> Приложение запущено</div>
      </section>
      <footer>Link Canvas <span>React · TypeScript · Vite</span></footer>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
