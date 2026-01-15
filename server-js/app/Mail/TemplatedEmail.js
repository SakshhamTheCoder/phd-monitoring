class TemplatedEmail {
    /* 
      Create a new message instance.
      */
    constructor(templateName, viewData = {}, subject = null) {
        this.templateName = templateName;
        this.viewData = viewData;

        if (subject) {
            this.subject = subject;
        } else {
            this.subject = 'New Notification';
        }
    }

    /*
     * Build the message.
     */
    build() {
        return {
            view: `emails.${this.templateName}`,
            data: this.viewData,
            subject: this.subject
        };
    }
}

export default TemplatedEmail;
