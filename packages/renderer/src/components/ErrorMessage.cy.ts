import { mount } from '@cypress/vue';
import ErrorMessage from './ErrorMessage.vue'

describe('<ErrorMessage />', () => {
  it('renders', () => {
    // see: https://on.cypress.io/mounting-vue
    mount(ErrorMessage)
  })
})