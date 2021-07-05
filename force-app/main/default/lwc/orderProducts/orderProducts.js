/**
 * Created by Dmitry Ivakhnenko on 29-Jun-2021.
 */

import { LightningElement, api, wire } from "lwc";
import { subscribe, MessageContext } from "lightning/messageService";
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import ORDER_PRODUCT_CHANNEL from '@salesforce/messageChannel/Order_Product__c';
import getOrderItems from '@salesforce/apex/OrderProductsController.getOrderItems';
import saveOrderItems from '@salesforce/apex/OrderProductsController.saveOrderItems';

export default class OrderProducts extends LightningElement {
  @api recordId;
  initialOrderItemsObj;  // To cancel all changes
  orderItemsList;  // List of Order Products to use on the page
  orderItemsObj = {};  // An easy way to find Order Products in
  noRecords;  // Show text messages instead of the records table
  error;

  @wire(MessageContext)
  messageContext;
  subscription = null;

  updateOrderItemsList() {
    this.orderItemsList = Object.values(this.orderItemsObj);

    // Yes, sorting everytime isn't efficient but fast to code
    this.orderItemsList.sort((a, b) => {
          if (a.Product2.Name > b.Product2.Name) {
            return 1;
          } else if (a.Product2.Name < b.Product2.Name) {
            return -1;
          }
          return 0;
    });

    this.noRecords = (this.orderItemsList.length > 0);
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
      /* I don't know what's wrong, but without reassignment it doesn't allow to change Quantity on saved records */
      const currentProduct = {...this.orderItemsObj[productName]};
      delete this.orderItemsObj[productName];
      currentProduct.Quantity++;
      this.orderItemsObj[productName] = currentProduct;
      this.updateTotalPrice(productName);
    }
    this.updateOrderItemsList();
  }

  removeProduct(productName) {
    /* I don't know what's wrong, but without reassignment it doesn't allow to change Quantity on saved records */
    const product = {...this.orderItemsObj[productName]};
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

  connectedCallback() {
    this.subscribeToMessageChannel();
    this.loadRecords();
  }

  loadRecords() {
    getOrderItems({ orderId: this.recordId })
      .then(result => this.processSuccessResult(result))
      .catch(error => this.serverError(error))
      .finally(() => {
        this.initialOrderItemsObj = {...this.orderItemsObj};
        this.updateOrderItemsList();
      });
  }

  processSuccessResult(result) {
    this.error = undefined;

    if (result.length) {
      result.forEach((element) => { this.orderItemsObj[element.Product2.Name] = element; });
    } else {
      this.orderItemsObj = {}
    }
  }

  serverError(error) {
    this.orderItemsObj = {};

    this.error = 'Unknown error';
    if (Array.isArray(error.body)) {
      this.error = error.body.map(e => e.message).join(', ');
    } else if (typeof error.body.message === 'string') {
      this.error = error.body.message;
    }
  }

  subscribeToMessageChannel() {
    this.subscription = subscribe(
      this.messageContext,
      ORDER_PRODUCT_CHANNEL,
      (message) => this.handleOrderProductMessage(message)
      );
  }

  handleOrderProductMessage(message) {
    const productId = message.productId;
    const productName = message.productName;
    const productUnitPrice = message.productPrice;
    const pricebookEntryId = message.pricebookEntryId;

    const record = {
        "Quantity": 1,
        "UnitPrice": productUnitPrice,
        "TotalPrice": productUnitPrice,
        "PricebookEntryId": pricebookEntryId,
        "OrderId": this.recordId,
        "Product2Id": productId,
        "Product2": {
          "Id": productId,
          "Name": productName
      }
    };
    this.addProduct(record);
  }

  handleProductClick(event) {
    this.removeProduct(event.currentTarget.dataset.name);
  }

  handleSave() {
    const orderItemsToDelete = this.getOrderItemsToDelete();

    saveOrderItems({
      orderItemsToUpsert: this.orderItemsList,
      orderItemsToDelete: orderItemsToDelete
    })
      .then(result => {
        this.processSuccessResult(result);

        // Show toast message
        const toastEvent = new ShowToastEvent({
          title: "Records saved",
          message: "Order Items has been saved",
          variant: "success"
        });
        this.dispatchEvent(toastEvent);
      })
      .catch(error => this.serverError(error))
      .finally(() => {
        this.initialOrderItemsObj = {...this.orderItemsObj};
        this.updateOrderItemsList();
      });
  }

  handleCancel() {
    this.orderItemsObj = {...this.initialOrderItemsObj};
    this.updateOrderItemsList();
  }
}