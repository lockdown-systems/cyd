import type { FacebookViewModel } from "./view_model";

export async function finishJob(
  vm: FacebookViewModel,
  jobIndex: number,
): Promise<void> {
  const finishedAt = new Date();
  vm.jobs[jobIndex].finishedAt = finishedAt;
  vm.jobs[jobIndex].status = "finished";
  vm.jobs[jobIndex].progressJSON = JSON.stringify(vm.progress);
  await window.electron.Facebook.updateJob(
    vm.account.id,
    JSON.stringify(vm.jobs[jobIndex]),
  );
  await window.electron.Facebook.setConfig(
    vm.account.id,
    `lastFinishedJob_${vm.jobs[jobIndex].jobType}`,
    finishedAt.toISOString(),
  );
  vm.log("finishJob", vm.jobs[jobIndex].jobType);
}

export async function errorJob(
  vm: FacebookViewModel,
  jobIndex: number,
): Promise<void> {
  vm.jobs[jobIndex].finishedAt = new Date();
  vm.jobs[jobIndex].status = "error";
  vm.jobs[jobIndex].progressJSON = JSON.stringify(vm.progress);
  await window.electron.Facebook.updateJob(
    vm.account.id,
    JSON.stringify(vm.jobs[jobIndex]),
  );
  vm.log("errorJob", vm.jobs[jobIndex].jobType);
}

// Persist a cumulative deletion total for a progress counter (for the server)
export async function incrementCumulativeTotal(
  vm: FacebookViewModel,
  counter: string,
  count: number,
): Promise<void> {
  if (count <= 0) {
    return;
  }
  const key = `total_${counter}`;
  const current = await window.electron.Facebook.getConfig(vm.account.id, key);
  const newValue = (current ? parseInt(current) : 0) + count;
  await window.electron.Facebook.setConfig(
    vm.account.id,
    key,
    newValue.toString(),
  );
}

export async function syncProgress(vm: FacebookViewModel): Promise<void> {
  // For now, just log progress - can be expanded to persist to database
  vm.log("syncProgress", JSON.stringify(vm.progress));
}
