<script setup lang="ts">
defineProps<{
  name: string;
  icon: string;
  description: string;
}>();

const emit = defineEmits(['click']);

const onCardClick = () => {
  emit('click');
};
</script>

<template>
  <div class="service-card mb-2 w-100" @click="onCardClick">
    <div class="card h-100">
      <div class="card-body d-flex align-items-center">
        <img :src="icon" :alt="name" class="icon me-3" />
        <div class="w-100 text-start">
          <h5 class="card-title mb-0">{{ name }}</h5>
          <p class="card-text">{{ description }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.service-card {
  cursor: pointer;
}

.service-card:hover .card {
  background-color: #f0f0f0;
}

.service-icon {
  width: 50px;
  height: auto;
}

.card {
  transition: background-color 0.2s ease-in-out;
}
</style>