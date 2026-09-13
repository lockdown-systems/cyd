/**
 * Translating AT Protocol shapes into Bluesky saved records.
 *
 * This is where a category's API surface becomes category-agnostic work for
 * the collection engine: everything downstream sees observations, selections,
 * subjects, and expected assets, never a lexicon.
 */

import { describe, expect, test } from "vitest";

import {
  observationFromRepoPost,
  observationFromPostView,
} from "../../collection/mapping";

const aliceAuthor = {
  did: "did:plc:examplealice",
  handle: "alice.test",
  displayName: "Alice",
  description: null,
  avatarSourceURL: null,
  bannerSourceURL: null,
};

describe("mapping a post from the account's own repository", () => {
  test("keeps the AT URI, CID, text, and creation time it was published with", () => {
    const observation = observationFromRepoPost(
      {
        uri: "at://did:plc:examplealice/app.bsky.feed.post/aaa",
        cid: "bafyaaa",
        value: {
          $type: "app.bsky.feed.post",
          text: "Hello Bluesky",
          createdAt: "2026-01-01T10:00:00.000Z",
        },
      },
      aliceAuthor,
    );

    expect(observation.uri).toEqual(
      "at://did:plc:examplealice/app.bsky.feed.post/aaa",
    );
    expect(observation.cid).toEqual("bafyaaa");
    expect(observation.recordType).toEqual("app.bsky.feed.post");
    expect(observation.text).toEqual("Hello Bluesky");
    expect(observation.createdAt).toEqual("2026-01-01T10:00:00.000Z");
    expect(observation.author.did).toEqual("did:plc:examplealice");
    expect(observation.assets).toEqual([]);
  });

  test("expects every embedded image as a blob in the author's own repository", () => {
    const observation = observationFromRepoPost(
      {
        uri: "at://did:plc:examplealice/app.bsky.feed.post/bbb",
        cid: "bafybbb",
        value: {
          $type: "app.bsky.feed.post",
          text: "Two pictures",
          createdAt: "2026-01-02T10:00:00.000Z",
          embed: {
            $type: "app.bsky.embed.images",
            images: [
              {
                alt: "first",
                image: { ref: { $link: "bafyimage1" }, mimeType: "image/jpeg" },
                aspectRatio: { width: 800, height: 600 },
              },
              {
                alt: "second",
                image: { ref: { $link: "bafyimage2" }, mimeType: "image/png" },
              },
            ],
          },
        },
      },
      aliceAuthor,
    );

    expect(observation.assets).toEqual([
      {
        kind: "image",
        role: "content",
        position: 0,
        mediaType: "image/jpeg",
        source: {
          type: "blob",
          did: "did:plc:examplealice",
          cid: "bafyimage1",
        },
        width: 800,
        height: 600,
        altText: "first",
      },
      {
        kind: "image",
        role: "content",
        position: 1,
        mediaType: "image/png",
        source: {
          type: "blob",
          did: "did:plc:examplealice",
          cid: "bafyimage2",
        },
        width: null,
        height: null,
        altText: "second",
      },
    ]);
  });

  test("expects a full video as a blob, not as the thumbnail a client would show", () => {
    const observation = observationFromRepoPost(
      {
        uri: "at://did:plc:examplealice/app.bsky.feed.post/ccc",
        cid: "bafyccc",
        value: {
          $type: "app.bsky.feed.post",
          text: "A video",
          createdAt: "2026-01-03T10:00:00.000Z",
          embed: {
            $type: "app.bsky.embed.video",
            alt: "a clip",
            video: { ref: { $link: "bafyvideo" }, mimeType: "video/mp4" },
          },
        },
      },
      aliceAuthor,
    );

    expect(observation.assets).toEqual([
      {
        kind: "video",
        role: "content",
        position: 0,
        mediaType: "video/mp4",
        source: { type: "blob", did: "did:plc:examplealice", cid: "bafyvideo" },
        width: null,
        height: null,
        altText: "a clip",
      },
    ]);
  });

  test("captures a reply parent and a quoted record as bounded context", () => {
    const observation = observationFromRepoPost(
      {
        uri: "at://did:plc:examplealice/app.bsky.feed.post/ddd",
        cid: "bafyddd",
        value: {
          $type: "app.bsky.feed.post",
          text: "Replying and quoting",
          createdAt: "2026-01-04T10:00:00.000Z",
          reply: {
            root: { uri: "at://did:plc:examplebob/app.bsky.feed.post/root" },
            parent: {
              uri: "at://did:plc:examplebob/app.bsky.feed.post/parent",
            },
          },
          embed: {
            $type: "app.bsky.embed.record",
            record: {
              uri: "at://did:plc:examplebob/app.bsky.feed.post/quoted",
            },
          },
        },
      },
      aliceAuthor,
    );

    expect(observation.context).toEqual([
      {
        kind: "reply_parent",
        recordURI: "at://did:plc:examplebob/app.bsky.feed.post/parent",
        external: null,
      },
      {
        kind: "quote",
        recordURI: "at://did:plc:examplebob/app.bsky.feed.post/quoted",
        external: null,
      },
    ]);
  });

  test("captures an external embed, expecting its preview image", () => {
    const observation = observationFromRepoPost(
      {
        uri: "at://did:plc:examplealice/app.bsky.feed.post/eee",
        cid: "bafyeee",
        value: {
          $type: "app.bsky.feed.post",
          text: "A link",
          createdAt: "2026-01-05T10:00:00.000Z",
          embed: {
            $type: "app.bsky.embed.external",
            external: {
              uri: "https://example.com/article",
              title: "An article",
              description: "About something",
              thumb: { ref: { $link: "bafythumb" }, mimeType: "image/jpeg" },
            },
          },
        },
      },
      aliceAuthor,
    );

    expect(observation.context).toEqual([
      {
        kind: "external",
        recordURI: null,
        external: {
          uri: "https://example.com/article",
          title: "An article",
          description: "About something",
        },
      },
    ]);
    expect(observation.assets).toEqual([
      {
        kind: "preview",
        role: "preview",
        position: 0,
        mediaType: "image/jpeg",
        source: { type: "blob", did: "did:plc:examplealice", cid: "bafythumb" },
        width: null,
        height: null,
        altText: null,
      },
    ]);
  });
});

describe("mapping a hydrated post someone else wrote", () => {
  test("captures the author as it was observed, avatar included", () => {
    const observation = observationFromPostView({
      uri: "at://did:plc:examplebob/app.bsky.feed.post/fff",
      cid: "bafyfff",
      author: {
        did: "did:plc:examplebob",
        handle: "bob.test",
        displayName: "Bob",
        avatar: "https://cdn.example/avatar/bob.jpg",
      },
      record: {
        $type: "app.bsky.feed.post",
        text: "Bob's post",
        createdAt: "2026-01-06T10:00:00.000Z",
      },
      indexedAt: "2026-01-06T10:00:01.000Z",
    });

    expect(observation.author).toEqual({
      did: "did:plc:examplebob",
      handle: "bob.test",
      displayName: "Bob",
      description: null,
      avatarSourceURL: "https://cdn.example/avatar/bob.jpg",
      bannerSourceURL: null,
    });
    expect(observation.indexedAt).toEqual("2026-01-06T10:00:01.000Z");
    expect(observation.text).toEqual("Bob's post");
  });

  test("expects a liked video's full bytes from the repository that holds it", () => {
    const observation = observationFromPostView({
      uri: "at://did:plc:examplebob/app.bsky.feed.post/ggg",
      cid: "bafyggg",
      author: { did: "did:plc:examplebob", handle: "bob.test" },
      record: {
        $type: "app.bsky.feed.post",
        text: "Bob's video",
        createdAt: "2026-01-07T10:00:00.000Z",
      },
      embed: {
        $type: "app.bsky.embed.video#view",
        cid: "bafybobvideo",
        playlist: "https://video.example/playlist.m3u8",
        thumbnail: "https://video.example/thumbnail.jpg",
        alt: "bob's clip",
      },
    });

    expect(observation.assets).toEqual([
      {
        kind: "video",
        role: "content",
        position: 0,
        mediaType: "video/mp4",
        source: {
          type: "blob",
          did: "did:plc:examplebob",
          cid: "bafybobvideo",
        },
        width: null,
        height: null,
        altText: "bob's clip",
      },
      {
        kind: "thumbnail",
        role: "thumbnail",
        position: 0,
        mediaType: "image/jpeg",
        source: { type: "url", url: "https://video.example/thumbnail.jpg" },
        width: null,
        height: null,
        altText: null,
      },
    ]);
  });

  test("expects the full-size image the AppView published, not its thumbnail", () => {
    const observation = observationFromPostView({
      uri: "at://did:plc:examplebob/app.bsky.feed.post/hhh",
      cid: "bafyhhh",
      author: { did: "did:plc:examplebob", handle: "bob.test" },
      record: {
        $type: "app.bsky.feed.post",
        text: "Bob's picture",
        createdAt: "2026-01-08T10:00:00.000Z",
      },
      embed: {
        $type: "app.bsky.embed.images#view",
        images: [
          {
            thumb: "https://cdn.example/thumb/1.jpg",
            fullsize: "https://cdn.example/full/1.jpg",
            alt: "a picture",
            aspectRatio: { width: 1000, height: 500 },
          },
        ],
      },
    });

    expect(observation.assets).toEqual([
      {
        kind: "image",
        role: "content",
        position: 0,
        mediaType: "image/jpeg",
        source: { type: "url", url: "https://cdn.example/full/1.jpg" },
        width: 1000,
        height: 500,
        altText: "a picture",
      },
    ]);
  });
});
