/**
 * Created by Dmitry Ivakhnenko on 29-Jun-2021.
 */

import { LightningElement, api, wire } from "lwc";
import { subscribe, MessageContext } from "lightning/messageService";
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import ORDER_PRODUCT_CHANNEL from '@salesforce/messageChannel/Order_Product__c';
import getOrder from '@salesforce/apex/OrderProductsController.getOrder';
import confirmOrder from '@salesforce/apex/OrderProductsController.confirmOrder';
import queueSaveOrderItems from '@salesforce/apex/OrderProductsController.queueSaveOrderItems';
import getSaveAsyncStatus from '@salesforce/apex/OrderProductsController.getSaveAsyncStatus';

export default class OrderProducts extends LightningElement {
  @api recordId;
  asyncJobStartedDatetime;  // Timestamp when async saving was started. To narrow jobs in SOQL
  error = undefined;  // Error to show to user
  disableAllButtons;  // Disables everything. Change to spinner?
  disableConfirmButton;  // Disable it if Contract isn't Activated or Order has not order items (I don't think empty order should be Confirmed)
  infoMessages;  // Messages for user
  initialOrderItemsObj;  // To cancel all changes
  isContractInactive;  // Only Activated Contracts allow order activation
  isOrderActivated;  // Activated order can't be changed
  isShowSpinner = false;  // TODO
  orderItemsList;  // List of Order Products to use on the page
  orderItemsObj = {};  // An easy way to find Order Products in
  noRecords;  // Show text messages instead of the records table

  @wire(MessageContext)
  messageContext;
  subscription = null;

  connectedCallback() {
    this.loadRecords();
    this.subscribeToMessageChannel();
    this.updateInfoMessages();
  }

  updateConfirmButtonStatus() {
    this.disableConfirmButton = this.disableAllButtons || this.isOrderActivated || this.isContractInactive || this.noRecords;
  }

  updateInfoMessages() {
    this.infoMessages = [];
    if (this.isOrderActivated) this.infoMessages.push('This order has been Activated. No changes are allowed');
    if (this.isContractInactive) this.infoMessages.push('Contract for this order is Inactive. This order can\'t be confirmed');
    if (this.noRecords) this.infoMessages.push('No products in this Order');
  }

  updateOrderItemsList() {
    this.orderItemsList = Object.values(this.orderItemsObj);

    // Yes, sorting everytime isn't efficient but fast to code
    this.orderItemsList.sort((a, b) => {
      if (a.Product2.Name > b.Product2.Name) return 1;
      else if (a.Product2.Name < b.Product2.Name) return -1;
      return 0;
    });

    this.noRecords = !(this.orderItemsList && this.orderItemsList.length > 0);
    this.updateConfirmButtonStatus();
    this.updateInfoMessages();
  }

  updateTotalPrice(productName) {
    let product = this.orderItemsObj[productName];

    product.TotalPrice = product.UnitPrice * product.Quantity;
    this.orderItemsObj[productName] = product;
  }

  addProduct(product) {
    const productName = product.Product2.Name;

    if (this.orderItemsObj[productName] === undefined) {
      this.orderItemsObj[productName] = product;
    } else {
      /* I don't know what's wrong, but without reassignment it doesn't allow to change saved records */
      const currentProduct = { ...this.orderItemsObj[productName] };
      delete this.orderItemsObj[productName];
      currentProduct.Quantity++;
      this.orderItemsObj[productName] = currentProduct;
      this.updateTotalPrice(productName);
    }
    this.updateOrderItemsList();
  }

  removeProduct(productName) {
    /* I don't know what's wrong, but without reassignment it doesn't allow to change saved records */
    const product = { ...this.orderItemsObj[productName] };
    delete this.orderItemsObj[productName];

    if (product.Quantity > 1) {
      product.Quantity--;
      this.orderItemsObj[productName] = product;
      this.updateTotalPrice(productName);
    }
    this.updateOrderItemsList();
  }

  getOrderItemsToDelete() {
    let orderItemsToDelete = [];
    Object.keys(this.initialOrderItemsObj).forEach((key) => {
      if (this.orderItemsObj[key] === undefined) orderItemsToDelete.push(this.initialOrderItemsObj[key]);
    });
    return orderItemsToDelete;
  }

  disableButtons() {
    this.disableAllButtons = true;
    this.updateConfirmButtonStatus();
  }

  enableButtons() {
    this.disableAllButtons = this.isOrderActivated;
    this.updateConfirmButtonStatus();
  }

  errorHandler(error) {
    if (Array.isArray(error.body)) {
      this.error = error.body.map(e => e.message).join(', ');
    } else if (typeof error.body?.message === 'string') {
      this.error = error.body.message;
    } else if (typeof error.body === 'string') {
      this.error = error.body;
    } else {
      this.error = 'Unknown error';
    }
  }

  loadRecords() {
    getOrder({ orderId: this.recordId })
      .then(result => {
        this.disableAllButtons = this.isOrderActivated = (result.Status === 'Activated');
        this.disableConfirmButton = this.isContractInactive = (result.Contract.Status !== 'Activated');
        this.processItemsAfterLoading(result.OrderItems);
      })
      .catch(error => {
        this.orderItemsObj = {};
        this.errorHandler(error);
      })
      .finally(() => {
        this.initialOrderItemsObj = { ...this.orderItemsObj };
        this.updateOrderItemsList();
      });
  }

  saveRecords(orderItemsToDelete, confirmOnComplete) {
    const datetime = new Date(Date.now());
    this.asyncJobStartedDatetime = datetime.toISOString();
    return queueSaveOrderItems({
      orderItemsToUpsert: this.orderItemsList,
      orderItemsToDelete: orderItemsToDelete
    })
      .then(() => { setTimeout(this.checkAsyncStatus.bind(this), 100, confirmOnComplete); })
      .catch(error => this.errorHandler(error));
  }

  /* Multiple queueing adds much complexity because we don't have one job Id to check it.
     And confirmation should start after successful save */
  checkAsyncStatus(confirmOnComplete) {
    getSaveAsyncStatus({ asyncStartedDatetime: this.asyncJobStartedDatetime })
      .then(result => {
        let isComplete = false;
        if (result === 'Completed') {
          isComplete = true;
          this.initialOrderItemsObj = { ...this.orderItemsObj };

          // Show toast message
          this.dispatchEvent(new ShowToastEvent({
            title: "Records saved",
            message: "Order Items have been saved",
            variant: "success"
          }));
        }
        return isComplete;
      })
      .then(isComplete => {
        if (isComplete) {
          if (confirmOnComplete) this.confirmOrder();
          else this.enableButtons();
        } else {
          setTimeout(this.checkAsyncStatus.bind(this), 100, confirmOnComplete);
        }
      })
      .catch(error => {
        this.errorHandler(error);

        // Show toast message
        this.dispatchEvent(new ShowToastEvent({
          title: "Records NOT saved",
          message: "Order Items have NOT been saved",
          variant: "error"
        }));
        this.enableButtons();
      });
  }

  confirmOrder() {
    return confirmOrder({ orderId: this.recordId })
      .then(result => {
        if (!result) {  // Order not confirmed
          this.error = 'Unable to confirm order. Try again later';
          return;
        }

        this.isOrderActivated = true;
        this.initialOrderItemsObj = { ...this.orderItemsObj };

        // Show toast message
        this.dispatchEvent(new ShowToastEvent({
          title: "Order confirmed",
          message: "Order has been confirmed",
          variant: "success"
        }));
      })
      .catch(error => this.errorHandler(error))
      .finally(() => {
        this.updateInfoMessages();
        this.enableButtons();
      });
  }

  processItemsAfterLoading(orderItems) {
    this.error = undefined;

    if (orderItems && orderItems.length) {
      orderItems.forEach(element => { this.orderItemsObj[element.Product2.Name] = element; });
    } else {
      this.orderItemsObj = {}
    }
  }

  subscribeToMessageChannel() {
    this.subscription = subscribe(
      this.messageContext,
      ORDER_PRODUCT_CHANNEL,
      message => this.handleOrderProductMessage(message)
      );
  }

  handleConfirm() {
    this.disableButtons();
    this.error = undefined;

    // Save order items before confirmation. No other info is changed by this LWC components
    this.saveRecords(this.getOrderItemsToDelete(), true);
  }

  handleOrderProductMessage(message) {
    if (this.isOrderActivated || this.disableAllButtons) return; // Can't change Activated order
    this.error = undefined;

    const productId = message.productId;
    const productName = message.productName;
    const productUnitPrice = message.productPrice;
    const pricebookEntryId = message.pricebookEntryId;

    const record = {
        "OrderId": this.recordId,
        "PricebookEntryId": pricebookEntryId,
        "Quantity": 1,
        "UnitPrice": productUnitPrice,
        "TotalPrice": productUnitPrice,
        "Product2Id": productId,
        "Product2": {
          "Id": productId,
          "Name": productName
      }
    };
    this.addProduct(record);
  }

  handleProductClick(event) {
    this.error = undefined;
    if (!this.disableAllButtons) this.removeProduct(event.currentTarget.dataset.name);
  }

  handleSave() {
    this.disableButtons();
    this.error = undefined;
    this.saveRecords(this.getOrderItemsToDelete());
  }

  handleUndo() {
    this.disableButtons();
    this.error = undefined;
    this.orderItemsObj = {...this.initialOrderItemsObj};
    this.updateOrderItemsList();
    this.enableButtons();
  }
}