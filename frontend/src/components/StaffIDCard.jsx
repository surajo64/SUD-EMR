import React from 'react';
import QRCode from 'react-qr-code';

/**
 * StaffIDCard Component
 * Renders a Portrait ATM-sized (54mm x 85.6mm) ID card.
 * Supports 'front' and 'back' sides.
 */
const StaffIDCard = ({ staff, settings, side = 'front' }) => {
    const cardWidth = '53.98mm';
    const cardHeight = '85.6mm';

    const goldAccent = '#ffd700';
    const deepNavy = '#001e3c';
    const mainBlue = '#2563eb';
    const premiumGradient = 'linear-gradient(180deg, #2563eb 0%, #7c3aed 100%)';

    const cardBaseStyle = {
        width: cardWidth,
        height: cardHeight,
        borderRadius: '16px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
        fontFamily: "'Inter', sans-serif",
        boxSizing: 'border-box',
        backgroundColor: '#2563eb',
        color: '#ffffff',
        margin: '10px auto',
        display: 'flex',
        flexDirection: 'column',
        borderTop: `5px solid ${goldAccent}`,
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

    // --- FRONT SIDE RENDER ---
    if (side === 'front') {
        return (
            <div style={cardBaseStyle} id={`staff-card-front-${staff?._id}`}>
                {/* Background Decor */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: premiumGradient, zIndex: 0 }} />
                <div style={{
                    position: 'absolute',
                    top: '-10%',
                    right: '-10%',
                    width: '120px',
                    height: '120px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '50%',
                    zIndex: 1
                }} />

                <div style={{ position: 'relative', zIndex: 2, height: '100%', padding: '20px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center' }}>

                    {/* Header */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            backgroundColor: 'white',
                            borderRadius: '12px',
                            padding: '6px',
                            marginBottom: '10px',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
                        }}>
                            {logoUrl ? (
                                <img src={logoUrl} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                            ) : (
                                <div style={{ fontSize: '8px', fontWeight: '900', color: deepNavy }}>ALJOUD</div>
                            )}
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center', lineHeight: 1.2 }}>
                            {settings?.reportHeader || 'ALJOUD HOSPITAL'}
                        </div>
                    </div>

                    {/* Staff Badge Title */}
                    <div style={{
                        backgroundColor: goldAccent,
                        color: deepNavy,
                        padding: '4px 16px',
                        borderRadius: '20px',
                        fontSize: '9px',
                        fontWeight: '900',
                        textTransform: 'uppercase',
                        letterSpacing: '2px',
                        marginTop: '15px'
                    }}>
                        OFFICIAL STAFF
                    </div>

                    {/* Identity Section */}
                    <div style={{ marginTop: 'auto', marginBottom: 'auto', textAlign: 'center', width: '100%' }}>
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            Authorized Personnel
                        </div>
                        <h2 style={{ fontSize: '18px', fontWeight: '900', margin: '4px 0', color: '#ffffff', lineHeight: 1.1 }}>
                            {staff?.name?.toUpperCase() || 'STAFF NAME'}
                        </h2>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: goldAccent, textTransform: 'uppercase' }}>
                            {staff?.role?.replace('_', ' ') || 'EMPLOYEE'}
                        </div>
                    </div>

                    {/* Footer / QR / Verification */}
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <div style={{ padding: '4px', backgroundColor: 'white', borderRadius: '6px', display: 'inline-block' }}>
                            <QRCode value={staff?._id || 'staff-id'} size={48} level="H" />
                        </div>
                        <div style={{ fontSize: '7px', fontWeight: '600', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            STAFF ID: {staff?._id?.slice(-8).toUpperCase() || 'EMP-001'}
                        </div>
                    </div>
                </div>

                {/* Subtle Watermark */}
                {logoUrl && (
                    <div style={{
                        position: 'absolute',
                        bottom: '10%',
                        left: '-15%',
                        opacity: 0.05,
                        width: '150px',
                        height: '150px',
                        zIndex: 1,
                        pointerEvents: 'none'
                    }}>
                        <img src={logoUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
                    </div>
                )}
            </div>
        );
    }

    // --- BACK SIDE RENDER ---
    return (
        <div style={{ ...cardBaseStyle, backgroundColor: '#ffffff', borderTop: `6px solid ${mainBlue}`, borderBottom: `6px solid ${mainBlue}`, color: '#2b2b2b' }} id={`staff-card-back-${staff?._id}`}>
            <div style={{ position: 'relative', zIndex: 1, padding: '24px 16px', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', fontWeight: '900', color: mainBlue, textTransform: 'uppercase' }}>
                        {settings?.reportHeader || 'ALJOUD HOSPITAL'}
                    </div>
                    <div style={{ width: '30px', height: '2px', background: goldAccent, margin: '6px auto' }} />
                </div>

                <div style={{ fontSize: '9px', textAlign: 'center', lineHeight: 1.6, color: '#444', fontWeight: '600' }}>
                    {settings?.address || 'Nigeria'}<br />
                    T: {settings?.phone || 'Contact Support'}
                </div>

                <div style={{ border: '1px dashed #ccc', padding: '12px', borderRadius: '8px', textAlign: 'center', backgroundColor: '#f9f9f9', width: '100%' }}>
                    <div style={{ fontSize: '8px', fontWeight: '800', marginBottom: '8px', color: '#666' }}>TERMS OF USE</div>
                    <div style={{ fontSize: '7px', lineHeight: 1.4, color: '#777' }}>
                        This credential is the property of Aljoud Hospital. Unauthorized use is prohibited.
                        If found, please deliver to the nearest Aljoud facility.
                    </div>
                </div>

                <div style={{ fontSize: '7px', fontWeight: '900', color: mainBlue, letterSpacing: '2px' }}>
                    AUTHORIZED SIGNATURE
                </div>
            </div>
        </div>
    );
};

export default StaffIDCard;
