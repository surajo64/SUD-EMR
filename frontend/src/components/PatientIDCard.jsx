import React from 'react';
import QRCode from 'react-qr-code';

/**
 * PatientIDCard Component
 * Renders an ATM-sized (85.6mm x 54mm) ID card.
 * Supports 'front' and 'back' sides.
 */
const PatientIDCard = ({ patient, settings, side = 'front' }) => {
    const cardWidth = '85.6mm';
    const cardHeight = '53.98mm';

    const deepNavy = '#001e3c';
    const mainBlue = '#2563eb';

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
        // Ensure white background shows in print
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
            <div style={cardBaseStyle} id={`patient-card-front-${patient?._id}`}>

                {/* "PATIENT ID" Text Watermark */}
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%) rotate(-30deg)',
                    fontSize: '38px',
                    fontWeight: '600',
                    color: 'rgba(37, 99, 235, 0.07)',
                    whiteSpace: 'nowrap',
                    letterSpacing: '6px',
                    zIndex: 1,
                    pointerEvents: 'none',
                    userSelect: 'none',
                    printColorAdjust: 'exact',
                    WebkitPrintColorAdjust: 'exact'
                }}>
                    PATIENT ID
                </div>

                {/* Logo Watermark */}
                {logoUrl && (
                    <div style={{
                        position: 'absolute',
                        top: '35%',
                        right: '-8%',
                        transform: 'rotate(-15deg)',
                        opacity: 0.06,
                        width: '160px',
                        height: '160px',
                        zIndex: 1,
                        pointerEvents: 'none'
                    }}>
                        <img src={logoUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', filter: 'grayscale(1)' }} />
                    </div>
                )}

                {/* Content Container */}
                <div style={{ position: 'relative', zIndex: 2, padding: '14px 18px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>

                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '44px',
                            height: '44px',
                            backgroundColor: 'white',
                            borderRadius: '10px',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid #e2e8f0'
                        }}>
                            {logoUrl ? (
                                <img src={logoUrl} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                            ) : (
                                <div style={{ fontSize: '10px', fontWeight: '900', color: deepNavy }}>ALJOUD</div>
                            )}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '15px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', color: mainBlue, lineHeight: 1.1 }}>
                                {settings?.reportHeader || 'ALJOUD HOSPITAL'}
                            </div>
                            <div style={{ fontSize: '7.5px', fontWeight: '600', color: '#555', textTransform: 'uppercase', letterSpacing: '2px', marginTop: '2px' }}>
                                Clinical Excellence
                            </div>
                        </div>
                    </div>

                    {/* Patient Identity */}
                    <div style={{ textAlign: 'left', padding: '0 2px' }}>
                        <div style={{ fontSize: '7px', fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>
                            Patient Name
                        </div>
                        <h2 style={{
                            fontSize: (patient?.name?.length > 22) ? '14px' : (patient?.name?.length > 16) ? '16px' : '18px',
                            fontWeight: '600',
                            margin: 0,
                            color: mainBlue,
                            lineHeight: 1.1
                        }}>
                            {patient?.name?.toUpperCase() || 'PATIENT NAME'}
                        </h2>
                    </div>

                    {/* Metadata Grid */}
                    <div style={{ width: '100%', boxSizing: 'border-box' }}>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 0.7fr 0.6fr 1.1fr',
                            gap: '8px',
                            background: '#f8fafc',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            width: '100%',
                            boxSizing: 'border-box'
                        }}>
                            <div style={{ overflow: 'hidden' }}>
                                <div style={{ fontSize: '6.5px', fontWeight: '700', color: mainBlue, textTransform: 'uppercase', marginBottom: '2px' }}>MRN</div>
                                <div style={{ fontSize: '8.5px', fontWeight: '800', color: '#000', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{patient?.mrn || 'N/A'}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '6.5px', fontWeight: '700', color: mainBlue, textTransform: 'uppercase', marginBottom: '2px' }}>Gender</div>
                                <div style={{ fontSize: '8.5px', fontWeight: '800', color: '#000', textTransform: 'capitalize' }}>{patient?.gender || 'N/A'}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '6.5px', fontWeight: '700', color: mainBlue, textTransform: 'uppercase', marginBottom: '2px' }}>Age</div>
                                <div style={{ fontSize: '8.5px', fontWeight: '800', color: '#000' }}>{patient?.age || 'N/A'} Yrs</div>
                            </div>
                            <div style={{ overflow: 'hidden', textAlign: 'right' }}>
                                <div style={{ fontSize: '6.5px', fontWeight: '700', color: mainBlue, textTransform: 'uppercase', marginBottom: '2px' }}>Category</div>
                                <div style={{ fontSize: '8.5px', fontWeight: '800', color: '#000', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {patient?.provider || 'Standard'}
                                </div>
                            </div>
                        </div>

                        {/* Specific Entity Info */}
                        {(patient?.hmo || patient?.familyFile) && (
                            <div style={{
                                width: '100%',
                                textAlign: 'right',
                                paddingRight: '4px',
                                marginTop: '4px',
                                boxSizing: 'border-box'
                            }}>
                                <div style={{
                                    fontSize: '8px',
                                    fontWeight: '850',
                                    color: mainBlue,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.2px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {patient?.hmo || (typeof patient?.familyFile === 'object' ? patient.familyFile.familyName : 'Family Member')}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer — MRN highlighted + label */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: '4px' }}>
                        <div style={{ fontSize: '8px', fontWeight: '700', color: '#aaa', letterSpacing: '2px', textTransform: 'uppercase' }}>
                            Patient Card
                        </div>
                        <div style={{ fontSize: '7px', fontWeight: '600', color: '#888' }}>
                            Ref: {new Date().getFullYear()}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- BACK SIDE RENDER ---
    return (
        <div style={{ ...cardBaseStyle, backgroundColor: '#ffffff', border: 'none', boxShadow: 'none', color: '#2b2b2b' }} id={`patient-card-back-${patient?._id}`}>
            <div style={{ position: 'relative', zIndex: 1, padding: '16px 20px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}>

                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#666', marginBottom: '2px' }}>Identification Property of</div>
                    <div style={{ fontSize: '16px', fontWeight: '900', color: mainBlue }}>{settings?.reportHeader || 'ALJOUD HOSPITAL'}</div>
                </div>

                <div style={{ textAlign: 'center', fontSize: '9px', color: '#444', fontWeight: '600' }}>
                    {settings?.address || 'Kano, Nigeria'}<br />
                    T: {settings?.phone || '07000000000'} | E: info@aljoud.com
                </div>

                <div style={{ width: '100%', padding: '10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: '8px', fontWeight: '800', color: mainBlue, marginBottom: '6px', textTransform: 'uppercase' }}>Scan for Verification</div>
                    <div style={{ padding: '6px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                        <QRCode value={`https://aljoud.com/verify/${patient?.mrn}`} size={64} level="M" />
                    </div>
                </div>

                <div style={{ fontSize: '8px', color: '#888', fontStyle: 'italic', textAlign: 'center', padding: '0 10px' }}>
                    This card is non-transferable. If found, please return to any Aljoud Hospital branch.
                </div>
            </div>
        </div>
    );
};

export default PatientIDCard;
