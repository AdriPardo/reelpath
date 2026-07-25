"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("../src/index.js");
const PROMPTS = [
    {
        type: 'idea_generation',
        version: '1.0.0',
        name: 'Idea Generator v1',
        template: `Genera {{count}} ideas de vídeo para YouTube en el nicho "{{niche}}".
Formato: {{format}}. Idioma: {{language}}.
Tendencias actuales: {{trends}}

Responde en JSON array con objetos:
{ "title", "hook", "angle", "targetAudience", "trendAlignment" (0-1), "rationale" }`,
        variables: ['count', 'niche', 'format', 'language', 'trends'],
    },
    {
        type: 'script_generation',
        version: '1.0.0',
        name: 'Script Generator v1',
        template: `Escribe un guion para YouTube {{format}} basado en esta idea:
Título: {{title}}
Hook: {{hook}}
Ángulo: {{angle}}

Genera DOS variantes de hook (A y B). Estructura optimizada para retención.
Incluye escenas con narration, visualPrompt, durationSec.

Responde JSON:
{ "title", "description", "tags", "variantA": { "hook", "scenes" }, "variantB": { "hook", "scenes" } }`,
        variables: ['format', 'title', 'hook', 'angle', 'language'],
    },
    {
        type: 'hook_ab',
        version: '1.0.0',
        name: 'Hook A/B v1',
        template: `Variante {{variant}}: Crea un hook de máximo 3 segundos para: {{title}}`,
        variables: ['variant', 'title'],
    },
];
const TEMPLATES = [
    {
        id: 'shorts-default',
        name: 'Shorts Default',
        config: {
            aspectRatio: '9:16',
            fps: 30,
            resolution: { width: 1080, height: 1920 },
            backgroundColor: '#0f0f0f',
            subtitleStyle: { fontSize: 48, fontColor: '#ffffff', position: 'bottom' },
            transitions: 'fade',
        },
    },
    {
        id: 'long-default',
        name: 'Long Form Default',
        config: {
            aspectRatio: '16:9',
            fps: 30,
            resolution: { width: 1920, height: 1080 },
            backgroundColor: '#0a0a0a',
            subtitleStyle: { fontSize: 36, fontColor: '#ffffff', position: 'bottom' },
            transitions: 'cut',
        },
    },
];
async function main() {
    for (const prompt of PROMPTS) {
        const existing = await index_js_1.prisma.promptVersion.findUnique({
            where: { type_version: { type: prompt.type, version: prompt.version } },
        });
        if (!existing) {
            const created = await index_js_1.prisma.promptVersion.create({
                data: {
                    type: prompt.type,
                    version: prompt.version,
                    name: prompt.name,
                    template: prompt.template,
                    variables: prompt.variables,
                    isActive: true,
                },
            });
            if (prompt.type === 'script_generation') {
                await index_js_1.prisma.promptVariant.createMany({
                    data: [
                        { promptVersionId: created.id, variantKey: 'A', weight: 0.5 },
                        { promptVersionId: created.id, variantKey: 'B', weight: 0.5 },
                    ],
                });
            }
        }
    }
    for (const tpl of TEMPLATES) {
        await index_js_1.prisma.videoTemplateRecord.upsert({
            where: { id: tpl.id },
            create: { id: tpl.id, name: tpl.name, config: tpl.config },
            update: { name: tpl.name, config: tpl.config },
        });
    }
    const channel = await index_js_1.prisma.channel.upsert({
        where: { slug: 'demo-tech' },
        create: {
            name: 'Demo Tech Channel',
            slug: 'demo-tech',
            niche: 'tecnología e IA',
            config: {
                niche: 'tecnología e IA',
                videoFormat: 'shorts',
                aspectRatio: '9:16',
                templateId: 'shorts-default',
                autoPublish: false,
                reviewRequired: true,
                ideasPerRun: 5,
                language: 'es',
            },
            isActive: true,
        },
        update: {},
    });
    const promptVersions = await index_js_1.prisma.promptVersion.findMany({ where: { isActive: true } });
    for (const pv of promptVersions) {
        await index_js_1.prisma.promptBinding.upsert({
            where: {
                channelId_promptType: { channelId: channel.id, promptType: pv.type },
            },
            create: {
                channelId: channel.id,
                promptVersionId: pv.id,
                promptType: pv.type,
            },
            update: { promptVersionId: pv.id },
        });
    }
    const trends = [
        { niche: 'tecnología e IA', topic: 'Agentes de IA autónomos', score: 0.92 },
        { niche: 'tecnología e IA', topic: 'GPT-5 y multimodal', score: 0.88 },
        { niche: 'tecnología e IA', topic: 'Automatización YouTube', score: 0.85 },
    ];
    for (const t of trends) {
        await index_js_1.prisma.trendSnapshot.create({ data: t });
    }
    console.log('Seed completed:', { channelId: channel.id, slug: channel.slug });
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => index_js_1.prisma.$disconnect());
