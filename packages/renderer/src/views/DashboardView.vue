<script setup lang="ts">
import { onMounted, inject, Ref, ref } from 'vue'
import ServerAPI from '../ServerAPI';

const showError = inject('showError') as (message: string) => void;
const navigate = inject('navigate') as (path: string) => void;

const xAccounts = ref<XAccount[]>([]);

const loadXAccounts = async () => {
    xAccounts.value = await (window as any).electron.setConfig("getXAccounts");
}

onMounted(async () => {
    await loadXAccounts()
})
</script>

<template>
    <div>
        <template v-if="xAccounts.length > 0">
            <p>Accounts are available.</p>
            <ul>
                <li v-for="(account, index) in xAccounts" :key="index">{{ account }}</li>
            </ul>
        </template>

        <template v-else>
            <div class="p-3">
                <p class="lead">With Semiphemeral, you can automatically delete your data in tech platforms, except for
                    what you want to keep.</p>
                <p>Ready to get started? Choose a platform.</p>
                <div class="d-flex flex-wrap">
                    <router-link to="/desired-path" class="text-decoration-none">
                        <div class="card m-2">
                            <div class="card-body">
                                <h5 class="card-title">
                                    <i class="fa-brands fa-square-x-twitter"></i>
                                    X (formerly Twitter)
                                </h5>
                                <p class="card-text">X, formerly Twitter, owned by billionaire man-baby Elon
                                    Musk, is a formerly-influential social media site that serves to boost Elon's
                                    ego and promote the far-right</p>
                            </div>
                        </div>
                    </router-link>

                    <router-link to="/desired-path" class="text-decoration-none">
                        <div class="card m-2">
                            <div class="card-body">
                                <h5 class="card-title">
                                    <i class="fa-brands fa-facebook"></i>
                                    Facebook
                                </h5>
                                <p class="card-text">Facebook, owned by Meta and Mark Zuckerberg, is a place to connect
                                    with friends, argues with racists, and have all of your private data shared with
                                    third parties in order to train AI models</p>
                            </div>
                        </div>
                    </router-link>

                    <router-link to="/desired-path" class="text-decoration-none">
                        <div class="card m-2">
                            <div class="card-body">
                                <h5 class="card-title">
                                    <i class="fa-brands fa-square-instagram"></i>
                                    Instagram
                                </h5>
                                <p class="card-text">Instagram, owned by Meta and Mark Zuckerberg, is a photo and video
                                    sharing platform that studies show is bad for mental health, and that shares your
                                    private data with third parties in order to train AI models</p>
                            </div>
                        </div>
                    </router-link>

                    <router-link to="/desired-path" class="text-decoration-none">
                        <div class="card m-2">
                            <div class="card-body">
                                <h5 class="card-title">
                                    <i class="fa-brands fa-reddit"></i>
                                    Reddit
                                </h5>
                                <p class="card-text">Reddit is a social news aggregation platform and forum that sells
                                    all your data to AI companies</p>
                            </div>
                        </div>
                    </router-link>

                    <router-link to="/desired-path" class="text-decoration-none">
                        <div class="card m-2">
                            <div class="card-body">
                                <h5 class="card-title">
                                    <i class="fa-brands fa-stack-overflow"></i>
                                    Stack Overflow
                                </h5>
                                <p class="card-text">Stack Overflow is question-and-answer website for programmers that
                                    sells all yoru data to AI companies</p>
                            </div>
                        </div>
                    </router-link>
                </div>
            </div>
        </template>
    </div>
</template>

<style scoped>
.card {
    width: 18rem;
}

.card-title .title-color {
    color: #154b5d;
}

.card-body:hover {
    background-color: #f0f0f0;
}
</style>