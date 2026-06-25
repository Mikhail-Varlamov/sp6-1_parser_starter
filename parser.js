const CURRENCY_BY_SYMBOL = {
    '$': 'USD',
    '€': 'EUR',
    '₽': 'RUB',
};

function getText(element) {
    return element ? element.textContent.trim() : '';
}

function stripSiteName(title) {
    return title.split('—')[0].trim();
}

function splitPrice(rawText) {
    const value = rawText.trim();
    const symbol = (value.match(/[$€₽]/) || [])[0] || '';
    const currency = CURRENCY_BY_SYMBOL[symbol] || null;
    const amount = value.replace(/[^\d.]/g, '');
    return { currency, amount };
}

function formatDate(rawDate) {
    const value = rawDate.trim();
    const pad = (part) => part.padStart(2, '0');

    let match = value.match(/^(\d{1,2})\D(\d{1,2})\D(\d{4})$/);
    if (match) {
        const [, day, month, year] = match;
        return `${pad(day)}.${pad(month)}.${year}`;
    }

    match = value.match(/^(\d{4})\D(\d{1,2})\D(\d{1,2})$/);
    if (match) {
        const [, year, month, day] = match;
        return `${pad(day)}.${pad(month)}.${year}`;
    }

    return value;
}

function parseMeta() {
    const metaContent = (selector) => {
        const tag = document.querySelector(selector);
        return tag ? tag.getAttribute('content') : '';
    };

    const opengraph = {};
    document.querySelectorAll('meta[property^="og:"]').forEach((tag) => {
        const key = tag.getAttribute('property').slice(3);
        let value = (tag.getAttribute('content') || '').trim();
        if (key === 'title') {
            value = stripSiteName(value);
        }
        opengraph[key] = value;
    });

    return {
        title: stripSiteName(document.title),
        description: metaContent('meta[name="description"]').trim(),
        keywords: metaContent('meta[name="keywords"]').trim().split(','),
        language: document.documentElement.lang,
        opengraph,
    };
}

function parseTags(productSection) {
    const tags = { category: [], discount: [], label: [] };
    const colorToType = { green: 'category', red: 'discount', blue: 'label' };

    productSection.querySelectorAll('.tags span').forEach((span) => {
        for (const color in colorToType) {
            if (span.classList.contains(color)) {
                tags[colorToType[color]].push(span.textContent.trim());
            }
        }
    });

    return tags;
}

function parsePrices(priceElement) {
    const oldPriceSpan = priceElement.querySelector('span');

    const clone = priceElement.cloneNode(true);
    const spanInClone = clone.querySelector('span');
    if (spanInClone) spanInClone.remove();

    const current = splitPrice(clone.textContent);
    const price = Number(current.amount);
    const currency = current.currency;

    if (oldPriceSpan) {
        const oldPrice = Number(splitPrice(oldPriceSpan.textContent).amount);
        const discount = oldPrice - price;
        const discountPercent = (discount / oldPrice * 100).toFixed(2) + '%';
        return { price, oldPrice, discount, discountPercent, currency };
    }

    return { price, oldPrice: null, discount: 0, discountPercent: '0%', currency };
}

function parseProperties(productSection) {
    const properties = {};
    productSection.querySelectorAll('.properties li').forEach((li) => {
        const cells = li.querySelectorAll('span');
        if (cells.length >= 2) {
            properties[cells[0].textContent.trim()] = cells[1].textContent.trim();
        }
    });
    return properties;
}

function parseDescription(productSection) {
    const descriptionElement = productSection.querySelector('.description');
    if (!descriptionElement) return '';

    const clone = descriptionElement.cloneNode(true);
    clone.querySelectorAll('*').forEach((node) => {
        while (node.attributes.length > 0) {
            node.removeAttribute(node.attributes[0].name);
        }
    });

    return clone.innerHTML.trim();
}

function parseImages(productSection) {
    const buttons = [...productSection.querySelectorAll('.preview nav button')];

    const images = buttons.map((button) => {
        const img = button.querySelector('img');
        return {
            preview: img.getAttribute('src'),
            full: img.dataset.src,
            alt: (img.getAttribute('alt') || '').trim(),
        };
    });

    let defaultIndex = buttons.findIndex((button) => button.hasAttribute('disabled'));

    if (defaultIndex < 0) {
        const mainImage = productSection.querySelector('.preview figure img');
        if (mainImage) {
            const mainSrc = mainImage.getAttribute('src');
            defaultIndex = images.findIndex((image) => image.full === mainSrc);
        }
    }

    if (defaultIndex > 0) {
        const [defaultImage] = images.splice(defaultIndex, 1);
        images.unshift(defaultImage);
    }

    return images;
}

function parseProduct() {
    const productSection = document.querySelector('.product');
    if (!productSection) return {};

    const likeButton = productSection.querySelector('.like');
    const prices = parsePrices(productSection.querySelector('.price'));

    return {
        id: productSection.dataset.id,
        name: getText(productSection.querySelector('h1')),
        isLiked: likeButton ? likeButton.classList.contains('active') : false,
        tags: parseTags(productSection),
        price: prices.price,
        oldPrice: prices.oldPrice,
        discount: prices.discount,
        discountPercent: prices.discountPercent,
        currency: prices.currency,
        properties: parseProperties(productSection),
        description: parseDescription(productSection),
        images: parseImages(productSection),
    };
}

function parseSuggested() {
    const cards = document.querySelectorAll('.suggested .items article');

    return [...cards].map((card) => {
        const { currency, amount } = splitPrice(getText(card.querySelector('b')));
        const image = card.querySelector('img');
        return {
            name: getText(card.querySelector('h3')),
            description: getText(card.querySelector('p')),
            image: image ? image.getAttribute('src') : '',
            price: amount,
            currency,
        };
    });
}

function parseReviews() {
    const cards = document.querySelectorAll('.reviews .items article');

    return [...cards].map((card) => {
        const avatar = card.querySelector('.author img');
        return {
            rating: card.querySelectorAll('.rating .filled').length,
            author: {
                avatar: avatar ? avatar.getAttribute('src') : '',
                name: getText(card.querySelector('.author span')),
            },
            title: getText(card.querySelector('.title')),
            description: getText(card.querySelector('p')),
            date: formatDate(getText(card.querySelector('.author i'))),
        };
    });
}

function parsePage() {
    return {
        meta: parseMeta(),
        product: parseProduct(),
        suggested: parseSuggested(),
        reviews: parseReviews(),
    };
}

window.parsePage = parsePage;
