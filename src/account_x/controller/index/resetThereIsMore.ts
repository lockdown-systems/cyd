import type { XAccountController } from "../../x_account_controller";

export async function resetThereIsMore(
  controller: XAccountController,
): Promise<void> {
  controller.thereIsMore = true;
}
