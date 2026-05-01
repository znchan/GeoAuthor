<template>
  <div class="row">
    <IllustrationCard
      :card-id="props.id"
      title="Illustration Break Down"
      :content="props.content"
    />
    <div class="textblock-drop-zone" @dragover.prevent @drop="onDrop">
      <TextBlock
        :card-id="props.id"
        :title="props.title"
        :content="props.content"
        @update:content="onContentUpdate"
        @split-request="onSplitRequest"
      />
    </div>
    <MapDisplay :card-id="props.id" :content="props.content" :version="props.version" />
  </div>
</template>

<script setup>
import IllustrationCard from './IllustrationCard.vue';
import TextBlock from './TextBlock.vue';
import MapDisplay from './MapDisplay.vue';
import { EventBus } from '@/utils/EventBus';

const props = defineProps({
  id: String,
  title: String,
  content: String,
  version: Number,
});

const emit = defineEmits(['merge-request', 'split-request', 'continue-writing', 'update:content']);

const onDrop = (event) => {
  const dt = event.dataTransfer;
  if (!dt) return;

  // Prefer payloads dropped from the map's place popup.
  const geoPayload = dt.getData('application/x-geo-place');
  if (geoPayload) {
    EventBus.emit('start-loading', 'Generating...');
    try {
      const parsed = JSON.parse(geoPayload);
      const placeName = parsed.placeName;
      if (placeName) {
        emit('continue-writing', { id: props.id, placeName });
      }
    } catch (e) {
      console.error('Invalid geo place payload', e);
      EventBus.emit('loading-done');
    }
    return;
  }

  // Multi-place payload dropped from the map selection toolbar.
  const multiGeoPayload = dt.getData('application/x-geo-multiple-places');
  if (multiGeoPayload) {
    EventBus.emit('start-loading', 'Generating...');
    try {
      // TODO: wire up backend continuation for multi-place descriptions.
      const parsed = JSON.parse(multiGeoPayload);
      const description = parsed.description;
      EventBus.emit('append-description', { description, cardId: props.id });
    } catch (e) {
      console.error('Invalid multiple geo places payload', e);
      EventBus.emit('loading-done');
    }
    return;
  }

  // Fallback: original row-merge drag logic from TextBlock.
  const sourceId = dt.getData('text/plain');
  const targetId = props.id;
  if (!sourceId || !targetId || sourceId === targetId) return;

  emit('merge-request', { sourceId, targetId });
};

const onSplitRequest = ({ before, after }) => {
  emit('split-request', { id: props.id, before, after });
};

const onContentUpdate = (val) => {
  emit('update:content', { id: props.id, content: val });
};
</script>

<style scoped>
.row {
  display: grid;
  grid-template-columns: 1.1fr 1.3fr 1.4fr;
  gap: 1rem;
  overflow: auto;
  padding: 0.5rem 1rem;
  align-items: start;
}
</style>
