<script setup lang="ts">
import { computed } from 'vue'
import { Service } from "../models";

const props = defineProps<{
    service: Service;
    isEditable: Boolean;
}>();

const emit = defineEmits(['click']);

const iconPath = computed(() => {
    if (props.service && 'serviceType' in props.service) {
        return `/${props.service.serviceType.toLowerCase()}-logo32.png`;
    }
    return '/default-logo32.png';
});

const name = computed(() => {
    return props.service.serviceType;
})

const description = computed(() => {
    return "not logged in yet"
})

const onCardClick = () => {
    if (!props.isEditable) {
        emit('click');
    }
};
</script>

<template>
    <div :class="{ 'service-card': !props.isEditable, 'service-card-editable': props.isEditable }" @click="onCardClick">
        <div class="card">
            <div class="card-body d-flex align-items-center">
                <img :src="iconPath" :alt="name" class="service-icon me-3" />
                <h5 class="card-title me-3">{{ name }}</h5>
                <p class="card-text">{{ description }}</p>
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

.service-card-editable {
    opacity: 0.6;
}

.service-icon {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
}

.card {
    transition: background-color 0.2s ease-in-out;
}
</style>