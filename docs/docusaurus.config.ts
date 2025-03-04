import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Cyd Docs',
  tagline: "Tech platforms can't be trusted. It's time to regain control of your data.",
  favicon: 'img/logo.png',
  url: 'https://docs.cyd.social',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  plugins: [[require.resolve('docusaurus-lunr-search'), {
    languages: ['en'] // language codes
  }]],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          // Useful options to enforce blogging best practices
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/social-card.png',
    navbar: {
      title: 'Cyd Docs',
      logo: {
        alt: 'Cyd Logo',
        src: 'img/logo.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        { to: '/blog', label: 'Development Blog', position: 'left' },
        {
          type: 'docsVersionDropdown',
          position: 'right',
          dropdownActiveClassDisabled: true,
        },
        {
          href: 'https://cyd.social',
          label: 'Cyd Website',
          position: 'right',
        },
        {
          href: 'https://github.com/lockdown-systems/cyd',
          label: 'Source Code',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Navigation',
          items: [
            {
              label: 'Docs',
              to: '/docs/intro',
            },
            {
              label: 'Development Blog',
              to: '/blog',
            },
            {
              label: 'Cyd Website',
              to: 'https://cyd.social',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Bluesky',
              href: 'https://bsky.app/profile/cyd.social',
            },
            {
              label: 'Mastodon',
              href: 'https://infosec.exchange/@cyd',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/lockdown-systems/cyd',
            },
            {
              label: 'X',
              href: 'https://x.com/cyd_social',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Newsletter',
              href: 'https://cyd.social/#/portal/signup',
            },
            {
              label: 'Pricing',
              href: 'https://cyd.social/pricing/',
            },
            {
              label: 'Download',
              href: 'https://cyd.social/download/',
            },
            {
              label: 'Dev Blog',
              to: '/blog',
            },
            {
              label: 'Credits',
              to: '/credits',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Lockdown Systems Collective`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
