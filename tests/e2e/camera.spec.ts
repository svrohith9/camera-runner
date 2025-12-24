import { test, expect } from "@playwright/test";

type PoseKeypoint = {
  name: string;
  x: number;
  y: number;
  score: number;
};

const buildKeypoints = (wristY: number): PoseKeypoint[] => [
  { name: "right_shoulder", x: 320, y: 120, score: 0.9 },
  { name: "right_elbow", x: 320, y: 180, score: 0.9 },
  { name: "right_wrist", x: 320, y: wristY, score: 0.9 },
];

const pumpFrames = async (page: import("@playwright/test").Page, wristY: number) => {
  for (let i = 0; i < 32; i += 1) {
    await page.evaluate((keypoints) => {
      window.__setMockPose?.(keypoints);
    }, buildKeypoints(wristY));
    await page.waitForTimeout(16);
  }
};

test("calibration flow and jump", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("calibration")).toBeVisible();
  await pumpFrames(page, 300);
  await pumpFrames(page, 120);

  await expect(page.getByText("Calibrated!")).toBeVisible();

  await page.waitForTimeout(500);
  const player = page.getByTestId("player");
  const initialTransform = await player.evaluate(
    (node) => window.getComputedStyle(node).transform
  );

  await pumpFrames(page, 120);
  await page.waitForTimeout(120);

  const jumpedTransform = await player.evaluate(
    (node) => window.getComputedStyle(node).transform
  );
  expect(jumpedTransform).not.toEqual(initialTransform);
});
