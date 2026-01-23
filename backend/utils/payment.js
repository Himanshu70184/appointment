const apac = require('authorizenet').APIControllers;
const Payment = require('../models/Payment');

const createTransaction = async (paymentData) => {
  try {
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

const processPayment = async (paymentData, userId, appointmentId) => {
  try {
    const transaction = await createTransaction(paymentData);
    
    if (transaction.success) {
      const payment = new Payment({
        user_id: userId,
        appointment_id: appointmentId,
        amount: paymentData.amount,
        transactionId: transaction.transactionId,
        status: 'completed',
        authorizeNetResponse: transaction.response
      });

      await payment.save();
      return { success: true, payment, transactionId: transaction.transactionId };
    } else {
      throw new Error(transaction.error);
    }
  } catch (error) {
    // Save failed payment record
    const payment = new Payment({
      user_id: userId,
      appointment_id: appointmentId,
      amount: paymentData.amount,
      status: 'failed',
      authorizeNetResponse: { error: error.message }
    });
    await payment.save();

    return { success: false, error: error.message || error.error };
  }
};

module.exports = {
  processPayment,
  createTransaction
};
