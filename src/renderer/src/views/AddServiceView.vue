<script setup lang="ts">
import { inject, onMounted } from 'vue'

const showError = inject('showError') as (message: string) => void;
const navigate = inject('navigate') as (path: string) => void;
const showBack = inject('showBack') as (text: string, navigation: string) => void;

const selectServiceClicked = async (service: string) => {
  if (service === 'X') {
    // If there's an X account with no username, navigate to it
    const xAccounts = await window.electron.getXAccounts();
    for (const xAccount of xAccounts) {
      if (xAccount.username === null) {
        console.log('Found an X account with no username so using that instead', xAccount.id)
        navigate(`/account/x/${xAccount.id}`);
        return;
      }
    }

    // Otherwise create a new X account
    console.log('Creating a new X account')
    const xAccount = await window.electron.createXAccount();
    navigate(`/account/x/${xAccount.id}`);
  } else {
    console.log('Service not yet implemented');
    showError('Service not yet implemented');
  }
}

onMounted(() => {
  showBack('Your accounts', '/dashboard');
});
</script>

<template>
  <div>
    <p class="lead">
      With Semiphemeral, you can automatically delete your data in tech platforms, except for
      what you want to keep.
    </p>
    <div class="p-3">
      <p>Ready to get started? Choose a platform.</p>
      <div class="d-flex flex-wrap">
        <div class="active card m-2" @click="selectServiceClicked('X')">
          <div class="card-body">
            <h5 class="card-title">
              <i class="fa-brands fa-square-x-twitter" />
              X (formerly Twitter)
            </h5>
            <p class="card-text">
              X, formerly Twitter, owned by billionaire man-baby Elon
              Musk, is a formerly-influential social media site that serves to boost Elon's
              ego and promote the far-right
            </p>
          </div>
        </div>

        <div class="coming-soon card m-2">
          <div class="card-body">
            <h5 class="card-title">
              <i class="fa-brands fa-facebook" />
              Facebook
            </h5>
            <p class="card-text">
              Facebook, owned by Meta and Mark Zuckerberg, is a place to connect
              with friends, argues with racists, and have all of your private data shared with
              third parties in order to train AI models
            </p>
          </div>
        </div>

        <div class="coming-soon card m-2">
          <div class="card-body">
            <h5 class="card-title">
              <i class="fa-brands fa-square-instagram" />
              Instagram
            </h5>
            <p class="card-text">
              Instagram, owned by Meta and Mark Zuckerberg, is a photo and video
              sharing platform that studies show is bad for mental health, and that shares your
              private data with third parties in order to train AI models
            </p>
          </div>
        </div>

        <div class="coming-soon card m-2">
          <div class="card-body">
            <h5 class="card-title">
              <i class="fa-brands fa-reddit" />
              Reddit
            </h5>
            <p class="card-text">
              Reddit is a social news aggregation platform and forum that sells
              all your data to AI companies
            </p>
          </div>
        </div>

        <div class="coming-soon card m-2">
          <div class="card-body">
            <h5 class="card-title">
              <i class="fa-brands fa-stack-overflow" />
              Stack Overflow
            </h5>
            <p class="card-text">
              Stack Overflow is question-and-answer website for programmers that
              sells all yoru data to AI companies
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  width: 18rem;
}

.card-title .title-color {
  color: #154b5d;
}

.card.active .card-body {
  cursor: pointer;
}

.card.active .card-body:hover {
  background-color: #bbe2f2;
}

.coming-soon {
  position: relative;
  filter: grayscale(100%);
  opacity: 0.6;
}

.coming-soon::after {
  content: "Coming Soon";
  position: absolute;
  bottom: 0;
  right: 0;
  width: auto;
  height: auto;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  font-weight: bold;
  font-size: 1rem;
  padding: 5px 10px;
}
</style>