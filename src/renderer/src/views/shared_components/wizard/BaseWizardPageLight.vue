<script setup lang="ts">
import BreadcrumbsComponent from "../BreadcrumbsComponent.vue";
import ButtonsComponent from "../ButtonsComponent.vue";
import type { ButtonInfo } from "../../../types";

// Props
interface Props {
  showBreadcrumbs?: boolean;
  showButtons?: boolean;
  breadcrumbProps?: {
    buttons: ButtonInfo[];
    label: string;
    icon?: string;
  };
  buttonProps?: {
    backButtons: ButtonInfo[];
    nextButtons: ButtonInfo[];
  };
}

withDefaults(defineProps<Props>(), {
  showBreadcrumbs: true,
  showButtons: true,
  breadcrumbProps: undefined,
  buttonProps: undefined,
});
</script>

<template>
  <div class="wizard-content">
    <BreadcrumbsComponent
      v-if="showBreadcrumbs && breadcrumbProps"
      v-bind="breadcrumbProps"
    />

    <slot name="content" />

    <ButtonsComponent v-if="showButtons && buttonProps" v-bind="buttonProps" />
  </div>
</template>

<style scoped>
/* No additional styles needed - inherits from parent wizard-content styling */
</style>
