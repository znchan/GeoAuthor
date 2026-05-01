import { ref } from 'vue';

/**
 * Application-wide publish/subscribe bus.
 *
 * Most events are scoped to a card by appending the card id to the event name,
 * e.g. `update-prompt-${cardId}`. The full list of supported channels is part
 * of the component contract and is documented in `docs/frontend-contracts.md`.
 * Avoid renaming or removing events without updating that document.
 */
const listeners = ref({});

export const EventBus = {
  /**
   * Subscribe to an event.
   * @param {string} event Event name.
   * @param {(...args: any[]) => void} callback Listener callback.
   */
  on(event, callback) {
    if (!listeners.value[event]) {
      listeners.value[event] = [];
    }
    listeners.value[event].push(callback);
  },

  /**
   * Unsubscribe from an event. When `callback` is omitted, all listeners for
   * the event are removed.
   * @param {string} event Event name.
   * @param {(...args: any[]) => void} [callback] Specific listener to remove.
   */
  off(event, callback) {
    if (!listeners.value[event]) return;
    if (callback) {
      const index = listeners.value[event].indexOf(callback);
      if (index > -1) {
        listeners.value[event].splice(index, 1);
      }
    } else {
      delete listeners.value[event];
    }
  },

  /**
   * Emit an event to all current listeners.
   * @param {string} event Event name.
   * @param {...any} args Arguments forwarded to each listener.
   */
  emit(event, ...args) {
    if (listeners.value[event]) {
      listeners.value[event].forEach((callback) => {
        callback(...args);
      });
    }
  },
};
