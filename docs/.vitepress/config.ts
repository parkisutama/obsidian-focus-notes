import { defineConfig } from "vitepress";

export default defineConfig({
    lang: "id-ID",
    title: "Focus Notes",
    description: "Panduan penggunaan dan pengembangan Focus Notes untuk Obsidian.",
    head: [["link", { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }]],
    srcDir: "./site",
    cleanUrls: true,
    lastUpdated: true,
    themeConfig: {
        nav: [
            { text: "Beranda", link: "/" },
            { text: "User", link: "/user/" },
            { text: "Developer", link: "/developer/" },
        ],
        sidebar: {
            "/user/": [
                {
                    text: "User",
                    items: [{ text: "Mulai dari sini", link: "/user/" }],
                },
                {
                    text: "Tutorial",
                    items: [{ text: "Sesi fokus pertama", link: "/user/tutorials/first-focus-session" }],
                },
                {
                    text: "How-to",
                    items: [
                        { text: "Tangkap ide ke Inbox", link: "/user/how-to/capture-to-inbox" },
                        { text: "Tambahkan contextual links", link: "/user/how-to/add-contextual-links" },
                        { text: "Selaraskan capture dan Timeline", link: "/user/how-to/align-capture-with-timeline" },
                    ],
                },
            ],
            "/developer/": [
                {
                    text: "Developer",
                    items: [{ text: "Orientasi", link: "/developer/" }],
                },
                {
                    text: "Explanation",
                    items: [
                        {
                            text: "Model dokumentasi",
                            link: "/developer/explanation/documentation-model",
                        },
                    ],
                },
                {
                    text: "Reference",
                    items: [{ text: "Peta fitur", link: "/developer/reference/feature-map" }],
                },
            ],
        },
        outline: {
            level: [2, 3],
            label: "Di halaman ini",
        },
        docFooter: {
            prev: "Sebelumnya",
            next: "Berikutnya",
        },
        lastUpdated: {
            text: "Terakhir diperbarui",
        },
        search: {
            provider: "local",
        },
    },
});
