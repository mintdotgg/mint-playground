import './styles.css'
import { StoreState } from './store/StoreState'
import { StoreUi } from './ui/StoreUi'

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('Robot Store could not find the application root.')

const state = new StoreState()
const ui = new StoreUi(root, state)

window.addEventListener('beforeunload', () => ui.destroy())
