import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import SpeechBubble from "./SpeechBubble.vue";
import CydAvatarComponent from "./CydAvatarComponent.vue";
import RunningIcon from "./RunningIcon.vue";

describe("SpeechBubble", () => {
  it("should render CydAvatar component", () => {
    const wrapper = mount(SpeechBubble, {
      props: {
        message: "Test message",
      },
    });

    const avatar = wrapper.findComponent(CydAvatarComponent);
    expect(avatar.exists()).toBe(true);
    expect(avatar.props("height")).toBe(140);
  });

  it("should render message with markdown parsing", () => {
    const wrapper = mount(SpeechBubble, {
      props: {
        message: "**Bold text** and *italic*",
      },
    });

    const bubble = wrapper.find(".bubble-inner");
    expect(bubble.exists()).toBe(true);
    expect(bubble.html()).toContain("<strong>Bold text</strong>");
    expect(bubble.html()).toContain("<em>italic</em>");
  });

  it("should render plain text message", () => {
    const wrapper = mount(SpeechBubble, {
      props: {
        message: "Simple plain text",
      },
    });

    const bubble = wrapper.find(".bubble-inner");
    expect(bubble.exists()).toBe(true);
    expect(bubble.text()).toContain("Simple plain text");
  });

  it("should render RunningIcon when message is empty", () => {
    const wrapper = mount(SpeechBubble, {
      props: {
        message: "",
      },
    });

    const runningIcon = wrapper.findComponent(RunningIcon);
    expect(runningIcon.exists()).toBe(true);

    const bubbleInner = wrapper.find(".bubble-inner");
    expect(bubbleInner.classes()).toContain("fs-1");
  });

  it("should apply correct styling classes", () => {
    const wrapper = mount(SpeechBubble, {
      props: {
        message: "Test",
      },
    });

    const bubble = wrapper.find(".bubble");
    expect(bubble.exists()).toBe(true);
    expect(bubble.classes()).toContain("p-3");
    expect(bubble.classes()).toContain("text-black");
  });

  it("should render markdown links", () => {
    const wrapper = mount(SpeechBubble, {
      props: {
        message: "[Click here](https://example.com)",
      },
    });

    const bubble = wrapper.find(".bubble-inner");
    expect(bubble.html()).toContain(
      '<a href="https://example.com">Click here</a>',
    );
  });

  it("should handle multiline markdown", () => {
    const message = `# Heading
    
This is a paragraph.

- List item 1
- List item 2`;

    const wrapper = mount(SpeechBubble, {
      props: {
        message,
      },
    });

    const bubble = wrapper.find(".bubble-inner");
    expect(bubble.html()).toContain("<h1");
    expect(bubble.html()).toContain("<p>");
    expect(bubble.html()).toContain("<ul>");
    expect(bubble.html()).toContain("<li>");
  });
});
