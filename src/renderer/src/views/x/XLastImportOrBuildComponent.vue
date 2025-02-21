<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { formatDistanceToNow } from 'date-fns';
import { State } from '../../view_models/XViewModel'
import { xGetLastImportArchive, xGetLastBuildDatabase } from '../../util_x'

const props = defineProps<{
    accountID: number;
    showButton: boolean;
    showNoDataWarning: boolean;
}>();

const emit = defineEmits<{
    setState: [value: State]
}>()

const lastImportArchive = ref<Date | null>(null);
const lastBuildDatabase = ref<Date | null>(null);

const buttonClicked = async () => {
    emit('setState', State.WizardDatabase);
};

onMounted(async () => {
    lastImportArchive.value = await xGetLastImportArchive(props.accountID);
    lastBuildDatabase.value = await xGetLastBuildDatabase(props.accountID);
});
</script>

<template>
    <div v-if="lastImportArchive || lastBuildDatabase || (showNoDataWarning && !lastImportArchive && !lastBuildDatabase)"
        :class="{ 'alert-warning': showNoDataWarning && !lastImportArchive && !lastBuildDatabase, 'alert-info': !(showNoDataWarning && !lastImportArchive && !lastBuildDatabase), 'alert': true }">
        <div v-if="lastImportArchive">
            You last imported your X archive {{ formatDistanceToNow(lastImportArchive, {
                addSuffix: true
            }) }}.
        </div>
        <div v-if="lastBuildDatabase">
            You last built your local database from scratch {{
                formatDistanceToNow(lastBuildDatabase, {
                    addSuffix: true
                }) }}.
        </div>
        <div v-if="showNoDataWarning && !lastImportArchive && !lastBuildDatabase">
            <div class="d-flex align-items-center">
                <i class="fa-solid fa-triangle-exclamation fa-2x me-3" />
                <div>
                    You'll need to import your local database of tweets, or build it from scratch, before you can delete
                    your tweets or likes, or migrate your tweets to Bluesky.
                </div>
            </div>
        </div>
        <div v-if="showButton" class="text-center">
            <button v-if="lastImportArchive || lastBuildDatabase" type="submit" class="btn btn-sm btn-secondary mt-2"
                @click="buttonClicked">
                Rebuild Your Local Database
            </button>
            <button v-else type="submit" class="btn btn-sm btn-primary mt-2" @click="buttonClicked">
                Build Your Local Database
            </button>
        </div>
    </div>
</template>

<style scoped></style>