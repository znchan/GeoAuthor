<template>
  <div class="geo-author-page w-full h-full p-0 m-0">
    <header
      class="app-header bg-slate-700 p-3 h-12 px-8 text-xl flex flex-row items-center text-white font-extrabold"
    >
      GeoAuthor
    </header>

    <main class="main-container">
      <Row
        v-for="content in contents"
        :key="content.id + '-' + (content.version ?? 0)"
        :id="content.id"
        :title="content.title"
        :content="content.content"
        @merge-request="handleMerge"
        @split-request="handleSplit"
        @continue-writing="handleContinueWriting"
        :version="content.version"
        @update:content="handleContentUpdate"
      />
    </main>

    <!-- Confirm split popup -->
    <div v-if="splitPopupVisible" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="splitPopupVisible = false"></div>

      <div
        class="split-popup relative bg-white dark:bg-slate-800 rounded-lg shadow-lg w-[92%] max-w-2xl p-4 z-10"
      >
        <header class="flex items-center justify-between mb-3" style="margin-bottom: 16px">
          <h3 class="text-lg font-semibold">Confirm Split</h3>
          <button class="text-gray-500 hover:text-gray-700" @click="splitPopupVisible = false">
            ✕
          </button>
        </header>

        <p class="text-sm text-gray-600 dark:text-gray-300 mb-4" style="margin-bottom: 16px">
          Please review the text segments below that will be created after the split. Confirm to
          proceed with the split operation.
        </p>

        <div class="flex justify-end gap-3">
          <button class="px-4 py-2 rounded bg-gray-200 text-sm" @click="splitPopupVisible = false">
            Cancel
          </button>
          <button
            class="px-4 py-2 rounded bg-slate-700 text-white text-sm"
            :disabled="!splitPayload || !splitPayload.id"
            @click="
              () => {
                performSplit(splitPayload.id, splitPayload.before, splitPayload.after);
                splitPopupVisible = false;
              }
            "
          >
            Confirm
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="global-loading-label">
      <div class="loading-box">
        {{ loadingText }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import Row from './components/Row.vue';
import { EventBus } from './utils/EventBus';
import { continue_writing_based_on_a_place } from './utils/BackendMsgs';

const SAMPLE_TOKYO_TRIP =
  "Our first day in Tokyo began at the iconic Senso-ji Temple,Tokyo's oldest Buddhist temple. The vibrant Nakamise shopping street leading up to the temple was bustling withtourists and locals alike, offering a variety of traditional snacks and souvenirs. After lunch, we headed to Akihabara, the electronics and anime mecca of Tokyo. We explored several multi-story electronics stores and visited a maidcafe for a unique cultural experience. In the evening, we drove through the vicinity of the Imperial Palace and saw it, and finally arrived at Odaiba, a large artificial island inTokyo Bay, where we enjoyed the futuristic architecture. We started our second day in the fabulous and charming neighborhood of Nakameguro. We took a leisurely morning stroll along the Meguro River, admiring the cherry trees lining its banks. The hip cafes and boutiques of the area provided a relaxing start to our day. In the afternoon, we headed to the lively Shibuya district that famous for its busy pedestrian crossing. We also paid our respects at the statueof Hachiko, the loyal dog, and indulged in some shopping atthe trendy department stores that Shibuya is known for. As the day progressed, we made our way to Shinjuku for ourfinal stop.";

const contents = ref([
  {
    id: 'card-1',
    title: 'This is the title',
    version: 0,
    content: SAMPLE_TOKYO_TRIP,
  },
]);

const handleMerge = ({ sourceId, targetId }) => {
  const sourceIndex = contents.value.findIndex((c) => c.id === sourceId);
  const targetIndex = contents.value.findIndex((c) => c.id === targetId);

  if (sourceIndex === -1 || targetIndex === -1 || sourceId === targetId) return;

  const source = contents.value[sourceIndex];
  const target = contents.value[targetIndex];

  // Append the source content to the target row.
  target.content = `${target.content}${source.content}`;

  contents.value.splice(sourceIndex, 1);
};

const splitPopupVisible = ref(false);
const splitPayload = ref(null);
const handleSplit = (payload) => {
  splitPopupVisible.value = true;
  splitPayload.value = payload;
};

const performSplit = (id, before, after) => {
  const index = contents.value.findIndex((c) => c.id === id);
  if (index === -1) return;

  contents.value[index].content = before;

  const newId = Date.now().toString();

  contents.value.splice(index + 1, 0, {
    id: newId,
    title: '',
    content: after,
    version: 0,
  });
};

const handleContinueWriting = async ({ id, placeName }) => {
  if (!id || !placeName) {
    delayLoadingDone();
    return;
  }
  const index = contents.value.findIndex((c) => c.id === id);
  if (index === -1) {
    delayLoadingDone();
    return;
  }

  const baseText = contents.value[index].content || '';
  try {
    EventBus.emit('start-loading', 'Continuing writing based on place...');
    const extra = await continue_writing_based_on_a_place(baseText, placeName);
    if (!extra) {
      delayLoadingDone();
      return;
    }
    contents.value[index].content = `${baseText}\n${extra}`;
    EventBus.emit(`close-geo-place-popup-${id}`);
  } catch (e) {
    console.error('continue_writing_based_on_a_place failed', e);
  }
  nextTick();
  delayLoadingDone();
};

const handleContentUpdate = ({ id, content }) => {
  const index = contents.value.findIndex((c) => c.id === id);
  if (index === -1) return;
  contents.value[index].content = content;
  delayLoadingDone();
};

const appendDescriptionToText = (data) => {
  const { description, cardId } = data;
  EventBus.emit('loading-done');
  if (!description) return;
  const index = contents.value.findIndex((c) => c.id === cardId);
  if (index === -1) return;
  contents.value[index].content = `${contents.value[index].content} \n\n ${description}`;
};

const handleReloadRow = ({ cardId }) => {
  if (!cardId) return;
  const index = contents.value.findIndex((c) => c.id === cardId);
  if (index === -1) return;
  contents.value[index].version = (contents.value[index].version ?? 0) + 1;
};

const handleContinueWritingByCsv = async (data) => {
  const { cardId, newText } = data;
  if (!cardId || !newText) {
    delayLoadingDone();
    return;
  }
  const index = contents.value.findIndex((c) => c.id === cardId);
  if (index === -1) {
    delayLoadingDone();
    return;
  }

  const baseText = contents.value[index].content || '';
  contents.value[index].content = `${baseText}\n${newText}`;
  delayLoadingDone();
};

const handleUpdateColorPosition = (data) => {
  const { cardId, oldColorPosition, newColorPosition } = data;
  if (!cardId) return;
  const index = contents.value.findIndex((c) => c.id === cardId);
  if (index === -1) return;
  if (!contents.value[index].content.includes(oldColorPosition) || oldColorPosition === '') {
    return;
  }
  contents.value[index].content = contents.value[index].content.replace(
    oldColorPosition,
    newColorPosition
  );
};

const loading = ref(false);
const loadingText = ref('');

const startLoading = (text) => {
  loading.value = true;
  loadingText.value = text !== '' ? text : 'Loading...';
};

const endLoading = () => {
  loading.value = false;
  loadingText.value = '';
};

const delayLoadingDone = () => {
  EventBus.emit('loading-done');
};

onMounted(() => {
  EventBus.on('append-description', appendDescriptionToText);
  EventBus.on('reload-row', handleReloadRow);
  EventBus.on('continues-write-by-csv', handleContinueWritingByCsv);
  EventBus.on('update-color-position', handleUpdateColorPosition);
  EventBus.on('start-loading', startLoading);
  EventBus.on('loading-done', endLoading);
});
onUnmounted(() => {
  EventBus.off('append-description', appendDescriptionToText);
  EventBus.off('reload-row', handleReloadRow);
  EventBus.off('continues-write-by-csv', handleContinueWritingByCsv);
  EventBus.off('update-color-position', handleUpdateColorPosition);
  EventBus.off('start-loading', startLoading);
  EventBus.off('loading-done', endLoading);
});
</script>

<style>
@import 'tailwindcss';

#app {
  width: 100vw;
  height: 100vh;
  padding: 0;
  margin: 0;
}

.geo-author-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  padding: 0;
}

.app-header {
  font-size: 1.5rem;
  font-weight: 600;
}

.main-container {
  display: flex;
  flex-direction: column;
  padding: 0.5rem;
  overflow: auto;
  flex-grow: 1;
}

.main-container > * {
  flex: 0 0 auto;
}

.global-loading-label {
  position: fixed;
  top: 4%;
  left: 50%;
  transform: translate(-50%, 0);
  z-index: 9999;
  pointer-events: none;
}

.loading-box {
  /* Dark, semi-transparent backdrop */
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  padding: 0.5rem 2.2rem;
  border-radius: 1.2rem;
  font-size: 1.1rem;
  font-weight: 500;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.18);
  text-align: center;
  pointer-events: all;
}

.split-popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.2);
  z-index: 40;
}

.split-popup {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 50;
  max-width: 450px;
}
</style>
