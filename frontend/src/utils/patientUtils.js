export const formatAge = (age) => {
    if (age === null || age === undefined || age === '') return 'N/A';
    
    // If it's already a string that looks like "X years" or "Y months", return it
    if (typeof age === 'string' && (age.includes('year') || age.includes('month'))) {
        return age;
    }

    const numAge = Number(age);
    if (isNaN(numAge)) return age;
    
    if (numAge < 1) {
        const months = Math.round(numAge * 12);
        if (months === 0) return '0 months';
        return `${months} month${months !== 1 ? 's' : ''}`;
    }
    const years = Math.floor(numAge);
    return `${years} year${years !== 1 ? 's' : ''}`;
};
