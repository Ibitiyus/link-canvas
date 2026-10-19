import { Component, type ReactNode } from "react";
import { STORAGE_KEY } from "../model/storage";
export class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null; message: string }
> {
  state = { error: null as Error | null, message: "" };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  backup = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        this.setState({
          message: "Сохранённый проект в этом браузере не найден.",
        });
        return;
      }
      const url = URL.createObjectURL(
        new Blob([raw], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "link-canvas-recovery.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      this.setState({ message: "Не удалось прочитать сохранение браузера." });
    }
  };
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="error-page">
        <main>
          <span className="error-label">[ APPLICATION_ERROR ]</span>
          <h1>Не удалось открыть приложение</h1>
          <p>
            Сохранённая страница не удалена.
            <br />
            Попробуйте обновить страницу или сохраните резервную копию.
          </p>
          <div className="error-actions">
            <button
              className="primary-button"
              onClick={() => location.reload()}
            >
              Повторить загрузку
            </button>
            <button className="secondary-button" onClick={this.backup}>
              Сохранить резервную копию
            </button>
          </div>
          {this.state.message && <p role="alert">{this.state.message}</p>}
          <details className="error-details">
            <summary>Технические сведения</summary>
            <pre>{this.state.error.message}</pre>
          </details>
        </main>
      </div>
    );
  }
}
