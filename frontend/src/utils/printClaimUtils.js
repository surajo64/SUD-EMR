// Print Claim Statement Functions for ClaimsManagement

export const fetchDefaultBank = async (userToken, setDefaultBank) => {
    try {
        const config = { headers: { Authorization: `Bearer ${userToken}` } };
        const { data } = await axios.get('http://localhost:5000/api/banks/default', config);
        setDefaultBank(data);
    } catch (error) {
        console.error('No default bank set:', error);
    }
};

export const handlePrintClaim = async (claimId, userToken, defaultBank, toast) => {
    try {
        const axios = require('axios');
        const config = { headers: { Authorization: `Bearer ${userToken}` } };
        const { data } = await axios.get(`http://localhost:5000/api/claims/${claimId}`, config);

        // Create printable content
        const printWindow = window.open('', '', 'width=800,height=600');
        printWindow.document.write(`
            <html>
            <head>
                <title>Claim Statement - ${data.claimNumber}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                    .header h1 { margin: 0; color: #2d5016; }
                    .section { margin: 20px 0; }
                    .section-title { font-weight: bold; font-size: 16px; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
                    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; font-weight: bold; }
                    .total-row { font-weight: bold; background-color: #f9f9f9; }
                    .bank-details { background-color: #f0f8ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
                    .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
                    @media print { button { display: none; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>SUD EMR - HMO Claim Statement</h1>
                    <p>Claim Number: ${data.claimNumber}</p>
                    <p>Date: ${new Date().toLocaleDateString()}</p>
                </div>

                <div class="section">
                    <div class="section-title">Patient Information</div>
                    <p><strong>Name:</strong> ${data.patient?.name || 'N/A'}</p>
                    <p><strong>MRN:</strong> ${data.patient?.mrn || 'N/A'}</p>
                    <p><strong>HMO:</strong> ${data.hmo?.name || 'N/A'}</p>
                    <p><strong>Encounter Date:</strong> ${new Date(data.encounter?.createdAt).toLocaleDateString()}</p>
                </div>

                <div class="section">
                    <div class="section-title">Services Rendered</div>
                    <table>
                        <thead>
                            <tr>
                                <th>Service Description</th>
                                <th>Type</th>
                                <th>Quantity</th>
                                <th>Unit Price</th>
                                <th>Total Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.claimItems.map(item => `
                                <tr>
                                    <td>${item.description}</td>
                                    <td>${item.chargeType}</td>
                                    <td>${item.quantity}</td>
                                    <td>₦${item.unitPrice.toLocaleString()}</td>
                                    <td>₦${item.totalAmount.toLocaleString()}</td>
                                </tr>
                            `).join('')}
                            <tr class="total-row">
                                <td colspan="4" style="text-align: right;">Total Claim Amount:</td>
                                <td>₦${data.totalClaimAmount.toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                ${defaultBank ? `
                <div class="bank-details">
                    <div class="section-title">Payment Details</div>
                    <p><strong>Bank Name:</strong> ${defaultBank.bankName}</p>
                    <p><strong>Account Name:</strong> ${defaultBank.accountName}</p>
                    <p><strong>Account Number:</strong> ${defaultBank.accountNumber}</p>
                    ${defaultBank.branchName ? `<p><strong>Branch:</strong> ${defaultBank.branchName}</p>` : ''}
                    ${defaultBank.swiftCode ? `<p><strong>SWIFT Code:</strong> ${defaultBank.swiftCode}</p>` : ''}
                </div>
                ` : '<p style="color: red;">No bank details available. Please contact administration.</p>'}

                <div class="footer">
                    <p>This is a computer-generated document. For inquiries, please contact the billing department.</p>
                    <p>Generated on ${new Date().toLocaleString()}</p>
                </div>

                <div style="text-align: center; margin: 20px;">
                    <button onclick="window.print()" style="padding: 10px 20px; background-color: #2d5016; color: white; border: none; border-radius: 5px; cursor: pointer;">Print</button>
                    <button onclick="window.close()" style="padding: 10px 20px; background-color: #666; color: white; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;">Close</button>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
    } catch (error) {
        console.error(error);
        toast.error('Error generating claim statement');
    }
};
