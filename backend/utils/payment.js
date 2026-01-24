const apac = require('authorizenet').APIControllers;
const Payment = require('../models/Payment');

// Test mode configuration
const TEST_MODE = process.env.NODE_ENV === 'development' || process.env.PAYMENT_TEST_MODE === 'true';

// Valid test card numbers for development
const TEST_CARDS = [
  '4111111111111111', // Visa
  '5424000000000015', // Mastercard
  '378282246310005',  // American Express
  '6011111111111117', // Discover
  '4007000000027',    // Visa (another variant)
  '5105105105105100'  // Mastercard (another variant)
];

const createTransaction = async (paymentData) => {
  try {
    // TEST MODE: Accept test cards and simulate successful payment
    if (TEST_MODE) {
      const cardNumber = paymentData.cardNumber.replace(/\s+/g, '');
      
      if (TEST_CARDS.includes(cardNumber)) {
        console.log('🧪 TEST MODE: Processing test card payment');
        
        // Simulate successful payment
        return {
          success: true,
          transactionId: `TEST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          response: {
            transId: `TEST-${Date.now()}`,
            accountNumber: `XXXX${cardNumber.slice(-4)}`,
            accountType: 'Visa',
            messages: [{
              code: 'TEST',
              description: 'This transaction has been approved (TEST MODE)'
            }]
          }
        };
      } else {
        // In test mode, reject invalid cards
        throw {
          success: false,
          error: 'Invalid test card. Use: 4111111111111111 for testing'
        };
      }
    }

    // PRODUCTION MODE: Use Authorize.Net API
    const merchantAuthenticationType = new apac.MerchantAuthenticationType();
    merchantAuthenticationType.setName(process.env.AUTHORIZE_NET_API_LOGIN_ID);
    merchantAuthenticationType.setTransactionKey(process.env.AUTHORIZE_NET_TRANSACTION_KEY);

    const creditCard = new apac.CreditCardType();
    creditCard.setCardNumber(paymentData.cardNumber.replace(/\s+/g, ''));
    creditCard.setExpirationDate(paymentData.expirationDate);
    creditCard.setCardCode(paymentData.cvv);

    const paymentType = new apac.PaymentType();
    paymentType.setCreditCard(creditCard);

    const customerAddress = new apac.CustomerAddressType();
    customerAddress.setFirstName(paymentData.firstName);
    customerAddress.setLastName(paymentData.lastName);
    customerAddress.setAddress(paymentData.address);
    customerAddress.setCity(paymentData.city);
    customerAddress.setState(paymentData.state);
    customerAddress.setZip(paymentData.zip);
    customerAddress.setCountry(paymentData.country || 'USA');

    const transactionRequestType = new apac.TransactionRequestType();
    transactionRequestType.setTransactionType(apac.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
    transactionRequestType.setPayment(paymentType);
    transactionRequestType.setAmount(paymentData.amount.toFixed(2));
    transactionRequestType.setBillTo(customerAddress);

    const createRequest = new apac.CreateTransactionRequest();
    createRequest.setMerchantAuthentication(merchantAuthenticationType);
    createRequest.setTransactionRequest(transactionRequestType);

    const ctrl = new apac.CreateTransactionController(
      createRequest.getJSON(),
      process.env.AUTHORIZE_NET_ENVIRONMENT === 'production'
    );

    return new Promise((resolve, reject) => {
      ctrl.execute(() => {
        const apiResponse = ctrl.getResponse();
        const response = new apac.CreateTransactionResponse(apiResponse);

        if (response.getMessages().getResultCode() === apac.MessageTypeEnum.OK) {
          const transResponse = response.getTransactionResponse();
          resolve({
            success: true,
            transactionId: transResponse.getTransId(),
            response: transResponse
          });
        } else {
          reject({
            success: false,
            error: response.getMessages().getMessage()[0].getText()
          });
        }
      });
    });
  } catch (error) {
    throw {
      success: false,
      error: error.message
    };
  }
};

const processPayment = async (userId, appointmentId, amount, paymentData) => {
  try {
    // Add amount to payment data
    const fullPaymentData = { ...paymentData, amount };
    
    const transaction = await createTransaction(fullPaymentData);
    
    if (transaction.success) {
      const payment = new Payment({
        user_id: userId,
        appointment_id: appointmentId,
        amount: amount,
        transactionId: transaction.transactionId,
        status: 'completed',
        paymentMethod: 'credit_card',
        authorizeNetResponse: transaction.response
      });

      await payment.save();
      
      if (TEST_MODE) {
        console.log(`✅ TEST PAYMENT: $${amount.toFixed(2)} - Transaction ID: ${transaction.transactionId}`);
      }
      
      return { success: true, payment, transactionId: transaction.transactionId };
    } else {
      throw new Error(transaction.error);
    }
  } catch (error) {
    console.error('❌ Payment failed:', error.message || error.error);
    
    // Save failed payment record
    const payment = new Payment({
      user_id: userId,
      appointment_id: appointmentId,
      amount: amount,
      status: 'failed',
      paymentMethod: 'credit_card',
      authorizeNetResponse: { error: error.message || error.error }
    });
    await payment.save();

    throw new Error(error.message || error.error || 'Payment processing failed');
  }
};

module.exports = {
  processPayment,
  createTransaction
};
