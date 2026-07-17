import './styles.css';
import { DynastyIndex } from './app/DynastyIndex';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Dynasty Index could not find its application root.');

const app = new DynastyIndex(root);
void app.start().catch((error: unknown) => {
  console.error('Dynasty Index failed to start.', error);
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => app.dispose());
}
