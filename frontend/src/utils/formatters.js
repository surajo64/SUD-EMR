/**
 * Formats a number into a compact string with suffixes (K, M, B, T).
 * If the number is less than 1000, it returns the number as is.
 * @param {number} num - The number to format
 * @param {number} digits - The number of decimal places
 * @returns {string} - Formatted number string
 */
export const formatCompactNumber = (num, digits = 2) => {
    if (num === null || num === undefined || isNaN(num)) return '0';
    if (num === 0) return '0';

    // Formatting logic: Million (M), Thousand (K) as requested
    const lookup = [
        { value: 1e12, symbol: "T" },
        { value: 1e9, symbol: "B" },
        { value: 1e6, symbol: "M" },
        { value: 1e3, symbol: "K" }
    ];

    const rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
    var item = lookup.find(function (item) {
        return num >= item.value;
    });

    return item ? (num / item.value).toFixed(digits).replace(rx, "$1") + item.symbol : num.toLocaleString();
};

/**
 * Formats currency in Naira with optional compact formatting starting at a threshold
 */
export const formatCurrency = (amount, threshold = 100000) => {
    const num = Number(amount) || 0;
    if (num >= threshold) {
        return `₦${formatCompactNumber(num)}`;
    }
    return `₦${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
