export class Pause
{ 
    private static continuePromise: Promise<boolean>;
    private static continueResolve: (value: boolean | PromiseLike<boolean>) => void;

    public static paused(): boolean {

        return !!this.continuePromise;

    }

    public static toggle() {

        this.paused() ? this.continue() : this.pause();

    }

    public static pause() {

        if (this.paused()) {
            return;
        }
        this.continuePromise = new Promise( (resolve, reject) => {
            this.continueResolve = resolve;
        });

    }

    public static continue() {

        if (this.continueResolve) {
            this.continueResolve(false);
            this.continueResolve = null;
            this.continuePromise = null;
        }

    }

    public static step() {

        if (this.paused()) {
            if (this.continueResolve) {
                this.continueResolve(true); // tell wait() to pause again
                this.continueResolve = null;
                this.continuePromise = null;
            }
        }

    }

    public static async wait(): Promise<void> {

        const step = await this.continuePromise;
        this.continuePromise = null;
        if (step) {
            this.pause();
        }

    }
}
