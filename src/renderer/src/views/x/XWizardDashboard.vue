<script setup lang="ts">
import {
    XViewModel,
    State
} from '../../view_models/XViewModel'

// Props
defineProps<{
    model: XViewModel;
}>();

// Emits
defineEmits<{
    setState: [value: State]
}>()
</script>

<template>
    <div class="wizard-content container mb-4 mt-3 mx-auto">
        <div class="mb-4">
            <h2>
                Claw back your data from your @{{ model.account.xAccount?.username }}
            </h2>
            <p class="text-muted">
                There are different ways to get data from your X account. How would you like to proceed?
            </p>
        </div>

        <div class="row">
            <div class="col-12 col-md-6 col-lg-6">
                <div class="card m-2">
                    <div class="card-body d-flex align-items-center">
                        <h1>
                            <i class="fa-solid fa-database" />
                            Local Database
                        </h1>
                    </div>
                </div>
            </div>
            <div class="col-12 col-md-6 col-lg-6">
                <div class="card m-2">
                    <div class="card-body d-flex align-items-center">
                        <h1>
                            <i class="fa-solid fa-fire" />
                            Delete from X
                        </h1>
                    </div>
                </div>
            </div>
            <div class="col-12 col-md-6 col-lg-6">
                <div class="card m-2">
                    <div class="card-body d-flex align-items-center">
                        <h1>
                            <i class="fa-brands fa-bluesky" />
                            Migrate to Bluesky
                        </h1>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped></style>
