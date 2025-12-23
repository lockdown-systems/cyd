import type { FacebookViewModel } from "./view_model";

export async function finishJob(
  vm: FacebookViewModel,
  jobIndex: number,
): Promise<void> {
  const finishedAt = new Date();
  vm.jobs[jobIndex].finishedAt = finishedAt;
  vm.jobs[jobIndex].status = "finished";
  vm.jobs[jobIndex].progressJSON = JSON.stringify(vm.progress);
  vm.log("finishJob", vm.jobs[jobIndex].jobType);

  // Save the last finished job timestamp for this job type
  await window.electron.Facebook.setConfig(
    vm.account.id,
    `lastFinishedJob_${vm.jobs[jobIndex].jobType}`,
    finishedAt.toISOString(),
  );
}

export async function errorJob(
  vm: FacebookViewModel,
  jobIndex: number,
): Promise<void> {
  vm.jobs[jobIndex].finishedAt = new Date();
  vm.jobs[jobIndex].status = "error";
  vm.jobs[jobIndex].progressJSON = JSON.stringify(vm.progress);
  vm.log("errorJob", vm.jobs[jobIndex].jobType);
}

export async function syncProgress(vm: FacebookViewModel): Promise<void> {
  // For now, just log progress - can be expanded to persist to database
  vm.log("syncProgress", JSON.stringify(vm.progress));
}
