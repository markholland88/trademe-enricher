export async function extractPropertyData(page) {
    // TODO: implement real extraction logic
    return {
        title: await page.title(),
        description: null,
        location: null,
        price: null,
        tags: [],
    };
}
