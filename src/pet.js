import Phaser from 'phaser';

const PET_SPEED = 0.5;

export const UPDATE_DELTA = 50;
export const FRAMES_PER_ROW = 13;
export const FRAMES_PER_ROW_ANIM = 9;

const range = (start, end) => Array.from({ length: (end - start) }, (v, k) => k + start);

function randomLayers() {
    // TODO: Expand the list to cover all LPC variety
    const PET_TYPE = [ 'spider' ];

    const PET_COLOR = {
        spider: [ 'spider01', 'spider02', 'spider03', 'spider04',
    'spider05', 'spider06', 'spider07', 'spider08', 'spider09',
    'spider10', 'spider11',]
    };

    const selectRandom = (items) => items[Math.floor(Math.random() * items.length)];

    const petType = selectRandom(PET_TYPE);
    const petColor = selectRandom(PET_COLOR[petType]);

    const layers = [
        `${petType}/${petColor}`,
    ]

    return layers.map(layer => `/lpc-pet/${layer}.png`);
}

function createAnim(scene, key, imageKey, i, row) {
    const { anims } = scene;
    const start = row * FRAMES_PER_ROW;
    const end = row * FRAMES_PER_ROW + FRAMES_PER_ROW_ANIM;
    const animKey = `${key}:${imageKey}:${i}`;
    anims.remove(animKey);
    anims.create({
        key: animKey,
        frames: anims.generateFrameNumbers(imageKey, { frames: range(start, end) }),
        frameRate: 10,
        repeat: -1
    });
}

function createSprites(scene, layers) {
    const petSprites = layers.map(layer => scene.add.sprite(0, 0, layer))
    petSprites.forEach((sprite, i) => {
        const imageKey = sprite.texture.key;
        createAnim(scene, 'player-up-walk', imageKey, i, 8);
        createAnim(scene, 'player-left-walk', imageKey, i, 9);
        createAnim(scene, 'player-down-walk', imageKey, i, 10);
        createAnim(scene, 'player-right-walk', imageKey, i, 11);
    });
    return petSprites;
}

function arrayEquals(a, b) {
    return Array.isArray(a) &&
        Array.isArray(b) &&
        a.length === b.length &&
        a.every((val, index) => val === b[index]);
}

const allLoaded = (scene, layers) => layers.every(layer => scene.textures.exists(layer));

export class Pet extends Phaser.GameObjects.Container{
    constructor({ scene, x, y, controlledByUser, layers = randomLayers() }) {
        const petSprites = createSprites(scene, ['skeleton']);

        super(scene, x, y, [...petSprites]);
        this.controlledByUser = controlledByUser;
        this.petSprites = petSprites;

        scene.physics.world.enableBody(this);
        this.body
            .setSize(20, 20)
            .setOffset(-10, 10)
            .setCollideWorldBounds(true);

        scene.physics.add.collider(this, scene.mainLayer);
        scene.physics.add.collider(this, scene.autotileLayer);

        this.preloadLayers(layers);
    }

    get layers() {
        return this.petSprites.map(sprite => sprite.texture.key);
    }

    preloadLayers(layers) {
        const scene = this.scene;
        for (let layer of layers) {
            scene.load.spritesheet({ key: layer, url: layer, frameConfig: { frameWidth: 64, frameHeight: 64 } });
        }

        scene.load.once(Phaser.Loader.Events.COMPLETE, () => this.updateLayers(layers));
        scene.load.start();
    }

    updateLayers(layers, recurse = true) {
        if (!allLoaded(this.scene, layers)) {
            if (recurse) {
                this.preloadLayers(layers);
            } else {
                layers.forEach(layer => {
                    if (!scene.textures.exists(layer)) {
                        console.error(`Couldn't load`, layer);
                    }
                });
            }
            return;
        }

        if (!arrayEquals(this.layers, layers)) {
            console.info('updating layers', this.layers, layers);
            for (let sprite of this.petSprites) {
                this.remove(sprite);
            }
            this.petSprites = createSprites(this.scene, layers);
            this.add(this.petSprites);
        }
    }

    updateFromRemote({ x, y, layers, frame, animName, animProgress }) {
        this.targetPosition = { x, y };

        if (layers) {
            this.updateLayers(layers);
        }

        if (animName) {
            this.play(animName, true);
            this.setAnimProgress(animProgress);
        } else {
            this.stopAnims();
            this.setSpriteFrame(frame);
        }
    }

    stopAnims() {
        for (let sprite of this.petSprites) {
            sprite.anims.stop();
        }
    }


    setSpriteFrame(frame) {
        for (let sprite of this.petSprites) {
            sprite.setFrame(frame);
        }
    }


    setAnimProgress(animProgress) {
        for (let sprite of this.petSprites) {
            if (sprite.anims.currentAnim) {
                sprite.anims.setProgress(animProgress);
            }
        }
    }

    play(animName, ignoreIfPlaying) {
        this.petSprites.forEach((sprite, i) => {
            const spriteAnimName = `${animName}:${sprite.texture.key}:${i}`;
            if (!this.scene.anims.exists(spriteAnimName)) {
                console.warn('No such animation', spriteAnimName);
                return;
            }
            sprite.play(spriteAnimName, ignoreIfPlaying);
        });
    }

    preUpdate(time, delta) {
        if (this.targetPosition) {
            this.setPosition(
                this.x + (this.targetPosition.x - this.x) / UPDATE_DELTA * delta,
                this.y + (this.targetPosition.y - this.y) / UPDATE_DELTA * delta,
            );
        }

        // NOTE: Adjust player depth to order multiple player sprites during render
        this.depth = this.y;

        if (!this.controlledByUser) {
            return;
        }

        const uiScene = this.scene.scene.get('UIScene');

        // Stop any previous movement from the last frame
        const prevVelocity = this.body.velocity.clone();
        this.body.setVelocity(0);

        const speed = 500 * PET_SPEED;

        if (uiScene.joystick) {
            this.body.setVelocityX(uiScene.joystick.forceX / uiScene.joystick.radius * speed);
            this.body.setVelocityY(uiScene.joystick.forceY / uiScene.joystick.radius * speed);
        }

        if (this.scene.cursors.left.isDown || this.scene.wasdCursors.left.isDown) {
            this.body.setVelocityX(-speed);
        } else if (this.scene.cursors.right.isDown || this.scene.wasdCursors.right.isDown) {
            this.body.setVelocityX(speed);
        }
        if (this.scene.cursors.up.isDown || this.scene.wasdCursors.up.isDown) {
            this.body.setVelocityY(-speed);
        } else if (this.scene.cursors.down.isDown || this.scene.wasdCursors.down.isDown) {
            this.body.setVelocityY(speed);
        }

        if (Math.abs(this.body.velocity.y) < Math.abs(this.body.velocity.x)) {
            if (this.body.velocity.x < 0) {
                this.play("player-left-walk", true);
            } else if (this.body.velocity.x > 0) {
                this.play("player-right-walk", true);
            }
        } else {
            if (this.body.velocity.y < 0) {
                this.play("player-up-walk", true);
            } else if (this.body.velocity.y > 0) {
                this.play("player-down-walk", true);
            }
        }

        if (!uiScene.joystick || uiScene.joystick.force > uiScene.joystick.radius) {
            // Normalize and scale the velocity so that player can't move faster along a diagonal
            this.body.velocity.normalize().scale(speed);
        }

        if (this.body.velocity.length() == 0) {
            // If we were moving, pick and idle frame to use
            this.stopAnims();
            if (prevVelocity.y < 0) {
                this.setSpriteFrame(FRAMES_PER_ROW * 8);
            } else if (prevVelocity.x < 0) {
                this.setSpriteFrame(FRAMES_PER_ROW * 9);
            } else if (prevVelocity.y > 0) {
                this.setSpriteFrame(FRAMES_PER_ROW * 10);
            } else if (prevVelocity.x > 0) {
                this.setSpriteFrame(FRAMES_PER_ROW * 11);
            }
        }
    }

}

