import React from 'react';
import QRCode from 'react-qr-code';

/**
 * EntityIDCard Component
 * Renders an ATM-sized (85.6mm x 54mm) ID card for HMOs or Retainerships.
 * Supports 'front' and 'back' sides.
 */
const EntityIDCard = ({ entity, settings, side = 'front' }) => {
    const cardWidth = '85.6mm';
    const cardHeight = '53.98mm';

    const deepNavy = '#001e3c';
    const mainBlue = '#2563eb';
    const accentPurple = '#7c3aed';

    const cardBaseStyle = {
        width: cardWidth,
        height: cardHeight,
        borderRadius: '14px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: 'none',
        fontFamily: "'Inter', sans-serif",
        boxSizing: 'border-box',
        backgroundColor: '#ffffff',
        color: '#000000',
        margin: '10px auto',
        display: 'flex',
        flexDirection: 'column',
        border: 'none',
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact'
    };

    // Helper to resolve logo URL
    const getLogoUrl = () => {
        if (!settings?.hospitalLogo) return null;
        if (settings.hospitalLogo.startsWith('data:image')) return settings.hospitalLogo;
        if (settings.hospitalLogo.startsWith('http')) return settings.hospitalLogo;
        const baseUrl = import.meta.env.VITE_BACKEND_URL || '';
        if (settings.hospitalLogo.startsWith('/uploads/') || settings.hospitalLogo.startsWith('uploads/')) {
            const separator = (baseUrl.endsWith('/') || settings.hospitalLogo.startsWith('/')) ? '' : '/';
            return `${baseUrl}${separator}${settings.hospitalLogo}`;
        }
        return `${baseUrl}/uploads/${settings.hospitalLogo}`;
    };

    const logoUrl = getLogoUrl();

    // Use entity category to determine theme color
    let themeColor = mainBlue;
    let cardTypeLabel = 'HMO PROVIDER CARD';
    let entityNameLabel = 'HMO PROVIDER NAME';
    let categoryWatermark = entity?.category?.toUpperCase() || 'EXTERNAL ENTITY';

    if (entity?.category === 'Retainership') {
        themeColor = accentPurple;
        cardTypeLabel = 'RETAINERSHIP CARD';
        entityNameLabel = 'RETAINERSHIP NAME';
    } else if (entity?.category === 'Family File' || entity?.familyName) {
        themeColor = '#059669'; // Emerald 600
        cardTypeLabel = 'FAMILY FILE CARD';
        entityNameLabel = 'FAMILY FILE NAME';
        categoryWatermark = 'FAMILY FILE';
    }

    // --- FRONT SIDE RENDER ---
    if (side === 'front') {
        return (
            <div style={cardBaseStyle} id={`entity-card-front-${entity?._id}`}>

                {/* Background Watermark */}
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%) rotate(-30deg)',
                    fontSize: '32px',
                    fontWeight: '600',
                    color: `${themeColor}12`, // 12 is hex for ~7% opacity
                    whiteSpace: 'nowrap',
                    letterSpacing: '4px',
                    zIndex: 1,
                    pointerEvents: 'none',
                    userSelect: 'none',
                }}>
                    {categoryWatermark}
                </div>

                {/* Content Container */}
                <div style={{ position: 'relative', zIndex: 2, padding: '14px 18px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>

                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid #e2e8f0'
                        }}>
                            {logoUrl ? (
                                <img src={logoUrl} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                            ) : (
                                <div style={{ fontSize: '9px', fontWeight: '900', color: deepNavy }}>ALJOUD</div>
                            )}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.5px', color: themeColor, lineHeight: 1.1 }}>
                                {settings?.reportHeader || 'ALJOUD HOSPITAL'}
                            </div>
                            <div style={{ fontSize: '7px', fontWeight: '600', color: '#666', textTransform: 'uppercase', letterSpacing: '1.5px', marginTop: '1px' }}>
                                Corporate Partners
                            </div>
                        </div>
                    </div>

                    {/* Entity Identity */}
                    <div style={{ textAlign: 'left', padding: '4px 2px' }}>
                        <div style={{ fontSize: '7px', fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px' }}>
                            {entityNameLabel}
                        </div>
                        <h2 style={{
                            fontSize: (entity?.name?.length > 22) ? '14px' : (entity?.name?.length > 16) ? '16px' : '18px',
                            fontWeight: '700',
                            margin: 0,
                            color: themeColor,
                            lineHeight: 1.1,
                            textTransform: 'uppercase'
                        }}>
                            {entity?.name || entity?.familyName || 'ENTITY NAME'}
                        </h2>
                    </div>

                    {/* Info Grid */}
                    <div style={{ width: '100%', boxSizing: 'border-box' }}>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '10px',
                            background: '#f8fafc',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: `1px solid ${themeColor}15`,
                            width: '100%',
                            boxSizing: 'border-box'
                        }}>
                            <div>
                                <div style={{ fontSize: '6.5px', fontWeight: '700', color: themeColor, textTransform: 'uppercase', marginBottom: '2px' }}>Reference Code</div>
                                <div style={{ fontSize: '9px', fontWeight: '800', color: '#000', fontMono: 'true' }}>{entity?.code || entity?.fileNumber || 'N/A'}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '6.5px', fontWeight: '700', color: themeColor, textTransform: 'uppercase', marginBottom: '2px' }}>Type/Category</div>
                                <div style={{ fontSize: '9px', fontWeight: '800', color: '#000' }}>
                                    {entity?.retainershipType ? `${entity.category} (${entity.retainershipType})` : (entity?.type || entity?.category || 'Family File')}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: '2px' }}>
                        <div style={{ fontSize: '8px', fontWeight: '700', color: '#aaa', letterSpacing: '1.5px' }}>
                            {cardTypeLabel}
                        </div>
                        <div style={{ fontSize: '7px', fontWeight: '600', color: '#888' }}>
                            Issued: {entity?.createdAt ? new Date(entity.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- BACK SIDE RENDER ---
    return (
        <div style={{ ...cardBaseStyle, backgroundColor: '#ffffff', color: '#2b2b2b' }} id={`entity-card-back-${entity?._id}`}>
            <div style={{ position: 'relative', zIndex: 1, padding: '16px 20px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}>

                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', fontWeight: '700', color: '#666', marginBottom: '2px' }}>Health Service Partner at</div>
                    <div style={{ fontSize: '15px', fontWeight: '900', color: themeColor }}>{settings?.reportHeader || 'ALJOUD HOSPITAL'}</div>
                </div>

                <div style={{ textAlign: 'center', fontSize: '8.5px', color: '#444', fontWeight: '600' }}>
                    {settings?.address || 'Kano, Nigeria'}<br />
                    T: {settings?.phone || '07000000000'} | E: info@aljoud.com
                </div>

                <div style={{ width: '100%', padding: '8px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: '7.5px', fontWeight: '800', color: themeColor, marginBottom: '5px', textTransform: 'uppercase' }}>Scan for Entity Verification</div>
                    <div style={{ padding: '5px', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white' }}>
                        <QRCode value={`https://aljoud.com/verify/entity/${entity?.code || entity?.fileNumber}`} size={60} level="M" />
                    </div>
                </div>

                <div style={{ fontSize: '7.5px', color: '#888', fontStyle: 'italic', textAlign: 'center', padding: '0 8px', lineHeight: 1.2 }}>
                    This card remains the property of Aljoud Hospital. It is for official identification purposes only.
                </div>
            </div>
        </div>
    );
};

export default EntityIDCard;
