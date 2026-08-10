// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import starlightLlmsTxt from 'starlight-llms-txt';
import starlightChangelogs, { makeChangelogsSidebarLinks } from 'starlight-changelogs';

// https://astro.build/config
export default defineConfig({
	site: 'https://arcovia.ghazikhan.in',
	// GitHub Pages hosts this project at /arcovia. Leaving the base unset for
	// local development keeps http://localhost:4321/ as the docs homepage.
	// base: process.env.SITE_BASE || undefined,
	integrations: [
		starlight({
			plugins: [starlightLlmsTxt({}), starlightChangelogs()],
			title: 'Arcovia',
			description:
				'Analyze React and Next.js projects, detect architectural issues, and turn complexity into actionable insights with deterministic, local-first analysis.',
			logo: {
				src: './src/assets/arcovia-logo.png',
				alt: 'Arcovia',
				replacesTitle: true,
			},
			favicon: '/images/icon.png',
			customCss: ['./src/styles/custom.css'],
			head: [
				{
					tag: 'meta',
					attrs: { property: 'og:image', content: 'https://arcovia.ghazikhan.in/images/banner.png' },
				},
				{
					tag: 'meta',
					attrs: { property: 'og:type', content: 'website' },
				},
				{
					tag: 'meta',
					attrs: { name: 'twitter:card', content: 'summary_large_image' },
				},
				{
					tag: 'meta',
					attrs: { name: 'twitter:image', content: 'https://arcovia.ghazikhan.in/images/banner.png' },
				},
				{
					tag: 'meta',
					attrs: {
						name: 'keywords',
						content:
							'react architecture analysis, next.js architecture, dependency graph, static analysis, code quality, architecture score, technical debt, react cli tool',
					},
				},
				{
					tag: 'script',
					attrs: { type: 'application/ld+json' },
					content: JSON.stringify({
						'@context': 'https://schema.org',
						'@type': 'SoftwareApplication',
						name: 'Arcovia',
						applicationCategory: 'DeveloperApplication',
						operatingSystem: 'macOS, Linux, Windows',
						description:
							'Architecture intelligence CLI for React and Next.js teams. Deterministic dependency graph analysis, findings, and a portable HTML report.',
						offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
						url: 'https://gkhan205.github.io/arcovia/',
						softwareVersion: '0.2.0',
					}),
				},
			],
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
						{ label: 'Custom policy rules', slug: 'guides/custom-policy-rules' },
					],
				},
				{
					label: 'Reference',
					items: [
						{ label: 'Scoring', slug: 'reference/scoring' },
						{ label: 'Findings', slug: 'reference/findings' },
					],
				},
				{
					label: 'Community',
					items: [
						{ label: 'Testimonials', slug: 'testimonials' },
						...makeChangelogsSidebarLinks([{ type: 'all', label: 'Changelog', base: 'changelog' }]),
					],
				},
			],
		}),
		sitemap(),
	],
});
