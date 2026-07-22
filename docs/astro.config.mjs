// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://gkhan205.github.io',
	// GitHub Pages hosts this project at /arcovia. Leaving the base unset for
	// local development keeps http://localhost:4321/ as the docs homepage.
	base: process.env.SITE_BASE || undefined,
	integrations: [
		starlight({
			title: 'Arcovia',
			description: 'Architecture intelligence for React and Next.js teams.',
			logo: {
				src: './src/assets/arcovia-logo.png',
				alt: 'Arcovia',
				replacesTitle: true,
			},
			favicon: '/images/icon.png',
			customCss: ['./src/styles/custom.css'],
			components: {
				Header: './src/components/MarketingHeader.astro',
				Footer: './src/components/SiteFooter.astro',
			},
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/gkhan205/arcovia' }],
			sidebar: [
				{
					label: 'Start here',
					items: [
						{ label: 'Introduction', slug: 'guides/introduction' },
						{ label: 'Quick start', slug: 'guides/quick-start' },
					],
				},
				{
					label: 'Use Arcovia',
					items: [
						{ label: 'Commands', slug: 'guides/commands' },
						{ label: 'Understand your report', slug: 'guides/reports' },
						{ label: 'Architecture policies', slug: 'guides/architecture-policies' },
					],
				},
				{
					label: 'Reference',
					items: [
						{ label: 'Scoring', slug: 'reference/scoring' },
						{ label: 'Findings', slug: 'reference/findings' },
					],
				},
			],
		}),
	],
});
