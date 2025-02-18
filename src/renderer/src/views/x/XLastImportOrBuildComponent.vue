<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { formatDistanceToNow } from 'date-fns';
import { State } from '../../view_models/XViewModel'
import { xGetLastImportArchive, xGetLastBuildDatabase } from '../../util_x'

const props = defineProps<{
    accountID: number;
    buttonText: string;
    buttonTextNoData: string;
    buttonState: State;
}>();

const emit = defineEmits<{
    setState: [value: State]
}>()

const lastImportArchive = ref<Date | null>(null);
const lastBuildDatabase = ref<Date | null>(null);

const buttonClicked = async () => {
    console.log('XLastImportOrBuildComponent', 'buttonClicked', props.buttonText, props.buttonState);
    emit('setState', props.buttonState);
};

onMounted(async () => {
    lastImportArchive.value = await xGetLastImportArchive(props.accountID);
    lastBuildDatabase.value = await xGetLastBuildDatabase(props.accountID);
});
</script>

<template>
    <div class="small text-center mb-3">
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
        <div v-if="!lastImportArchive && !lastBuildDatabase">
            <div>
                Cyd can unfollow everyone and delete your direct messages right away
            </div>
            <div>
                <i class="fa-solid fa-triangle-exclamation" />
                You'll need to import or build your database to delete your tweets
            </div>
        </div>
        <button type="submit" class="btn btn-sm btn-link text-nowrap" @click="buttonClicked">
            <template v-if="lastImportArchive || lastBuildDatabase">
                {{ buttonText }}
            </template>
            <template v-else>
                {{ buttonTextNoData }}
            </template>
        </button>
    </div>
</template>

<style scoped></style>