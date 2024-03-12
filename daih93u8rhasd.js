console.log("Dawgcrys || Hooked")
var scene = new THREE.Scene();
var secondary_scene = new THREE.Scene();
var textureLoader = new THREE.TextureLoader();
var raycaster = new THREE.Raycaster;
var FOV = 100;
var materials = {};
var camera = new THREE.PerspectiveCamera(FOV, window.innerWidth / window.innerHeight, 0.1, 1000);
var secondary_camera = new THREE.PerspectiveCamera(60);
//moved renderer
var geometry = new THREE.BoxGeometry();
materials.defaultMaterial = new THREE.MeshBasicMaterial({
    map: textureLoader.load(missing)
});
scene.background = new THREE.Color(0xffffff);
var PointerLock = new THREE.PointerLockControls(camera, renderer.domElement);
camera.position.set(0, 0, 0);
var Sun = new THREE.DirectionalLight(0x342a04, 1, 1000);
Sun.position.set(5, 10, 2);
scene.add(Sun);
var secondary_Sun = Sun.clone();
secondary_Sun.position.set(0, 1, 1);
secondary_scene.add(secondary_Sun);
Sun.CastShadow = true;
renderer.shadowMap.enabled = true;
var AmbientLight = new THREE.AmbientLight(0x989461);
scene.add(AmbientLight);
var world = new CANNON.World();
collisionMaterial = new CANNON.Material();
var collisionContactMaterial = new CANNON.ContactMaterial(collisionMaterial, collisionMaterial, {
    friction: -10,
    restitution: 0.0
});
world.addContactMaterial(collisionContactMaterial);
world.gravity.y = -5
var loader = new THREE.GLTFLoader();
var preload = {};
var mixers = [];
var listener = new THREE.AudioListener();
camera.add(listener);
clock = new THREE.Clock();
document.addEventListener('contextmenu', event => event.preventDefault());
camera.position.set(0, 16, 16);
camera.rotation.set(THREE.MathUtils.degToRad(-45), 0, 0);
scene.add(camera);
secondary_camera.position.set(0, 0, 5);
var paused = false;
var players = [];
var me = null;
var him = "he is always watching";
var position = {
    x: 0,
    y: 2,
    z: 0
};
var rotation = {
    x: 0,
    y: 0
};
var speed = 15;
var inGame = false;
var username = null;
var disconnected = false;
var reason = false;
var walking = false;
var crouch = false;
var decal_limit = 420;
var decals = [];
var current_weapon = "NONE";
var camera_bobbing = 1;
var damage_cooldown = false;
var camera_damage = 0;
var automatic_shooting = false;
var lastShoot = 0;
var ammo = 0;
var dead = false;
var killer = "";
var reloading = false;
var lastUpdate = 0;
var delta = 0;
var old_ = 0;
var settings = {
    thirdPerson: false,
    thirdPersonZoom: 0.75,
    nametags: false,
    ping: false,
    sounds: false,
    FOV: 420,
    arms: false,
    hitbox: false,
};
var player_height = 4;
var canPause = false;
var isScoping = false;
var ping = 0;
var version = "1.0.0_beta1_01";
var CONFIG_SERVER = window.CONFIG_SERVER || "localhost";
var PROTOCOL = "ws";
if (CONFIG_SERVER != "localhost") PROTOCOL = "wss";

function createMaterial(name, base64) {
    if (materials[name]) return;
    var texture = textureLoader.load((!base64 && "assets/textures/" || "") + name + (!base64 && ".png" || ""));
    var test = new Image();
    test.src = (!base64 && "assets/textures/" || "") + name + (!base64 && ".png" || "");
    test.onerror = function() {
        texture.image = materials.defaultMaterial.map.image;
        texture.needsUpdate = true;
    }
    materials[name] = new THREE.MeshBasicMaterial({
        map: texture,
        alphaTest: 0.95
    });
}

function preloadModel(name) {
    loader.load("assets/models/" + name + ".glb", function(model) {
        preload[name] = model.scene;
        preload[name].model = model;
        preload[name].animations = model.animations
    });
}

//preloads
preloadModel("char");
preloadModel("ak-47");
preloadModel("pistol");
preloadModel("m24");
createMaterial("decals/bullet_1");
createMaterial("decals/bullet_2");
createMaterial("bullet/bullet");
createMaterial("bullet/muzzle_flash");

Math.clamp = (num, min, max) => Math.min(Math.max(num, min), max);
class Player {
    constructor(username, id) {
        this.character = THREE.SkeletonUtils.clone(preload['char']);
        this.character.animations = preload['char'].animations;
        this.mixer = new THREE.AnimationMixer(this.character);
        mixers.push(this.mixer);
        this.collision = new CANNON.Body({
            mass: 5,
            material: collisionMaterial
        });
        this.collision.position.set(0, 2, 0);
        this.collision.player = this;
        this.collision.addShape(new CANNON.Box(new CANNON.Vec3(0.5, 2, 0.5)));
        this.collision.angularDamping = 1;
        var this_ = this;
        this.collision.addEventListener("collide", function() {
            this_.jumping = false
        });
        this.weapon_bone = this.character.children[0].children[0].children[0].children[2].children[0].children[0].children[0];
        this.weapon = undefined;
        this.nameTag = makeTextSprite(username, {
            fontface: "BlockBuilder3D"
        });
        this.nameTag.position.set(0, 0.1, 0);
        this.nameTag.material.map.offset.x = -0.36;
        this.hitbox = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
            wireframe: true
        }));
        this.character.add(this.hitbox);
        this.character.children[0].children[0].children[0].children[0].add(this.nameTag);
        world.add(this.collision);
        scene.add(this.character);
        this.id = id;
        this.movement = [0, 0, 0, 0];
        this.isMe = false;
        this.jumping = false;
        this.username = username;
        this.kills = 0;
        this.walking = false;
        this.walkSounds = {};
        this.position = new THREE.Vector3(0, 2, 0);
        if (this.id == me) {
            this.isMe = true;
        }
        this.clips = {};
        this.playAnimation = function(name, once, notoverwrite, weight, clamp) {
            if (!once) once = false;
            var clip = this.mixer.clipAction(THREE.AnimationClip.findByName(this.character.animations, name));
            if (this.clips[name] && !notoverwrite) this.clips[name].reset();
            if (notoverwrite && this.clips[name]) return;
            this.clips[name] = clip;
            if (weight) clip.weight = weight;
            if (once) clip.repetitions = 1;
            if (clamp) clip.clampWhenFinished = true;
            clip.play();
            return clip;
        }
        this.stopAnimation = function(name) {
            if (!this.clips[name]) return;
            this.clips[name].stop();
            this.clips[name] = undefined;
        }
        this.updateCollision = function() {
            this.collision.shapes[0].updateConvexPolyhedronRepresentation();
            this.collision.shapes[0].updateBoundingSphereRadius();
            this.collision.computeAABB();
            this.collision.updateMassProperties();
        }
        this.setWeapon = function(data) {
            this.weapon = THREE.SkeletonUtils.clone(preload[GAME_WEAPON_TYPES[data.weapon].model]);
            this.weapon.animations = preload[GAME_WEAPON_TYPES[data.weapon].model].animations;
            this.weapon.mixer = new THREE.AnimationMixer(this.weapon);
            mixers.push(this.weapon.mixer);
            this.weapon.reloadAnim = this.weapon.mixer.clipAction(THREE.AnimationClip.findByName(this.weapon.animations, "weapon.reload"));
            this.weapon.reloadAnim.repetitions = 1;
            var quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(0), THREE.MathUtils.degToRad(90), THREE.MathUtils.degToRad(175)));
            this.weapon.quaternion.copy(quat);
            this.weapon.quat = quat;
            var this_ = this;
            this.weapon.reload = function() {
                this_.playAnimation("weapon.reload." + this_.weapon.type, true, false, 10000000);
                if (this_.weapon.reloadAnim.isRunning()) return;
                this_.weapon.reloadAnim.reset();
                this_.weapon.reloadAnim.play();
            }
            this.weapon.type = data.weapon;
            setTimeout(function() {
                this_.character.children[0].children[0].children[0].children[2].children[0].children[0].children[0].add(this_.weapon);
            }, 20);
        }
        players[id] = this;
    }
    jump() {
        raycaster.set(this.position, new THREE.Vector3(0, -1, 0));
        var hit = raycaster.intersectObject(MAP);
        if (hit[0] && hit[0].distance < 2.09) {
            this.collision.velocity.y = 7.5;
            ws.send(JSON.stringify({
                jump: true
            }));
            this.jumping = true;
        }
    }
    delete() {
        this.character.removeFromParent();
        if (this.weapon) this.weapon.removeFromParent();
        this.nameTag.removeFromParent();
        delete(players[this.id]);
    }
}

function spawnDecal(position, normal) {
    var rotation = new THREE.Vector3();
    rotation.z = normal.x * 1.5707963267948966;
    rotation.x = normal.z * 1.5707963267948966;
    var decal = "";
    if (decals.length != decal_limit) {
        decal = new THREE.Mesh(geometry, materials["decals/bullet_" + Math.round(Math.random() + 1)]);
        scene.add(decal);
    } else {
        decal = decals[0];
        decals.shift();
    }
    decal.scale.set(0.25, 0, 0.25);
    decal.position.set(position.x + (normal.x / 100), position.y + (normal.y / 100), position.z + (normal.z / 100));
    decal.rotation.set(rotation.x, rotation.y, rotation.z);
    decals.push(decal);
    return decal;
}

function fogEffect(position) {
    var hit = new THREE.Sprite(new THREE.SpriteMaterial({
        map: textureLoader.load("assets/textures/bullet/hit.png")
    }));
    scene.add(hit);
    hit.position.set(position.x, position.y, position.z);
    hit.material.rotation = Math.random() * 6.28;
    hit.scale.set(0.01, 0.01, 0.01);

    function _0xf01f1() {
        hit.material.opacity -= 0.002;
        hit.scale.x += 0.005;
        hit.scale.y += 0.005;
        hit.scale.z += 0.005;
        if (hit.material.opacity <= 0) {
            hit.removeFromParent();
            return;
        }
        setTimeout(_0xf01f1, 1);
    }
    _0xf01f1();
    return hit;
};

function collideEffect(position, material) {
    var hit = new THREE.Sprite(new THREE.SpriteMaterial({
        map: textureLoader.load("assets/textures/material_particles/" + material + ".png")
    }));
    scene.add(hit);
    hit.position.set(position.x, position.y, position.z);
    hit.material.rotation = Math.random() * 6.28;
    hit.scale.set(0.2, 0.2, 0.2);

    function _0xf01f1() {
        hit.material.opacity -= 0.02;
        hit.scale.x += 0.1;
        hit.scale.y += 0.1;
        hit.scale.z += 0.1;
        if (hit.material.opacity <= 0) {
            hit.removeFromParent();
            return;
        }
        setTimeout(_0xf01f1, 1);
    }
    _0xf01f1();
    return hit;
}

function mainLoop() {
    //PAUSE SCREEN
    if (!paused) {
        renderer.render(scene, camera);
        document.getElementById("pause").style.display = "none";
    } else {
        document.getElementById("pause").style.display = "block";
    }
    secondary_renderer.render(secondary_scene, secondary_camera);

    //CALCULATE DELTA
    delta = (Date.now() - lastUpdate) / 1000;
    lastUpdate = Date.now();

    //UPDATE ANIMATIONS
    mixers.forEach(function(mixer) {
        mixer.update(delta);
    });

    //UPDATE CAMERA
    camera.updateProjectionMatrix();

    //UPDATE PLAYERS
    Object.values(players).forEach(function(player) {
        /*
        v = new THREE.Vector3();
        q = new THREE.Quaternion();
        player.weapon_bone.getWorldPosition(v);
        player.weapon_bone.getWorldQuaternion(q);
        q = quaternionEuler(q);
        q[1] -= 90;
        q[2] -= 180;
        q = eulerQuaternion([q[0], q[1], q[2]]);
        q = new THREE.Quaternion(q[0], q[1], q[2], q[3]);
        //weapon position
        if(player.weapon) {
          //player.weapon.position.copy(v);
          //player.weapon.quaternion.copy(q);
        }
        */
        //nametag visibility
        player.nameTag.visible = settings.nametags;

        //hitbox size
        player.hitbox.scale.set(player.collision.shapes[0].halfExtents.x * 2, player.collision.shapes[0].halfExtents.y * 2, player.collision.shapes[0].halfExtents.z * 2);

        //hitbox visibility
        player.hitbox.visible = settings.hitbox && (player != players[me] || settings.thirdPerson);
    });

    //CHECK WEBSOCKET
    if (window.ws && ws.readyState == 3) {
        error(reason || "The server you were in has gone down.");
        if (!localStorage.disconnect) localStorage.disconnect = "0";
        localStorage.disconnect = JSON.stringify(Number(localStorage.disconnect) + 1);
        return;
    }

    //GAME LOOP
    requestAnimationFrame(mainLoop);

    //ONLY CONTINUE IF IN GAME
    if (!window.ws || ws.readyState != 1) {
        return;
    }

    //UPDATE SETTINGS
    settings.thirdPerson = document.getElementById("third_person").checked;
    settings.nametags = document.getElementById("nametags").checked;
    settings.ping = document.getElementById("ping").checked;
    settings.sounds = document.getElementById("sounds").checked;
    settings.FOV = document.getElementById("fov").value;
    settings.arms = document.getElementById("arms").checked;

    //UPDATE SAVED SETTINGS
    localStorage.third_person = settings.thirdPerson;
    localStorage.nametags = settings.nametags;
    localStorage.ping = settings.ping;
    localStorage.sounds = settings.sounds;
    localStorage.fov = settings.FOV;
    localStorage.arms = settings.arms;

    paused = !PointerLock.isLocked && canPause && document.activeElement != document.getElementById("talk") && !dead;
    document.getElementsByClassName("loading")[0].style.display = "none";
    document.getElementsByClassName("chat")[0].style.display = "block";
    document.getElementsByClassName("instructions")[0].style.display = "block";
    document.getElementById("leaderboard").style.display = "block";
    username = document.getElementById("username").value;
    document.getElementById("ping_text").style.display = (settings.ping && "block") || "none";
    if (!camera.fov) camera.fov = 100;
    var list = Object.values(players).sort(function(a, b) {
        return b.kills - a.kills;
    });
    try {
        if (list[0].kills == 0) {
            document.getElementById("leaderboard").innerHTML = "";
        } else {
            document.getElementById("leaderboard").innerHTML = "<h3>LEADERBOARD</h3>";
            document.getElementById("leaderboard").innerHTML += "<b>1</b>. ";
            var first = document.createElement("text");
            first.innerText = list[0].username;
            document.getElementById("leaderboard").appendChild(first);
            document.getElementById("leaderboard").innerHTML += " with " + list[0].kills + " kills<br>";
            if (list[1].kills) {
                document.getElementById("leaderboard").innerHTML += "<b>2</b>. ";
                var second = document.createElement("text");
                second.innerText = list[1].username;
                document.getElementById("leaderboard").appendChild(second);
                document.getElementById("leaderboard").innerHTML += " with " + list[1].kills + " kills<br>";
            }
            if (list[2].kills) {
                document.getElementById("leaderboard").innerHTML += "<b>3</b>. ";
                var third = document.createElement("text");
                third.innerText = list[2].username;
                document.getElementById("leaderboard").appendChild(third);
                document.getElementById("leaderboard").innerHTML += " with " + list[2].kills + " kills<br>";
            }
        }
    } catch (e) {}
    if (killer != "" && dead && players[killer]) {
        document.getElementById("killedBy").style.display = "block";
        document.getElementById("killedBy").innerHTML = "Killed by " + players[killer].username;
        try {
            document.getElementById("killedBy").style.innerHTML = players[killer].username;
        } catch (e) {}
    } else {
        document.getElementById("killedBy").style.display = "none";
    }
    if (dead) {
        document.getElementsByClassName("death_overlay")[0].style.opacity = 0.3;
        document.getElementsByClassName("health")[0].style.display = "none";
        document.getElementsByClassName("health_content")[0].style.display = "none";
        document.getElementsByClassName("health_content")[1].style.display = "none";
        document.getElementById("ammo").style.display = "none";
    } else {
        document.getElementsByClassName("death_overlay")[0].style.opacity = 0;
        document.getElementsByClassName("health")[0].style.display = "block";
        document.getElementsByClassName("health_content")[0].style.display = "block";
        document.getElementsByClassName("health_content")[1].style.display = "block";
        document.getElementById("ammo").style.display = "block";
    }
    if (players[me]) {
        if (automatic_shooting && Date.now() - lastShoot > GAME_WEAPON_TYPES[current_weapon].shootTime * 1000) {
            shootWeapon();
            lastShoot = Date.now();
        }
        if (current_weapon != "NONE") {
            if (isScoping) {
                players[me].playAnimation("weapon.scope." + current_weapon, false, true, 1000);
            } else {
                players[me].stopAnimation("weapon.scope." + current_weapon);
            }
        }
        position.x = players[me].collision.position.x
        position.y = players[me].collision.position.y
        position.z = players[me].collision.position.z
        camera.rotation.order = "YXZ";
        rotation.x = THREE.MathUtils.radToDeg(camera.rotation.x);
        rotation.y = THREE.MathUtils.radToDeg(camera.rotation.y);
        camera.position.set(players[me].collision.position.x + camera_damage, players[me].collision.position.y + player_height / 2.6 + (Math.sin(camera_bobbing) / 10) + camera_damage, players[me].collision.position.z + camera_damage);
        if (settings.thirdPerson) camera.position.addScaledVector(new THREE.Vector3(0, 0, settings.thirdPersonZoom).applyQuaternion(camera.quaternion), 5)
        var temporaryEuler0 = new THREE.Euler(0, camera.rotation.y, 0);
        var temporaryEuler = new THREE.Vector3((players[me].movement[3] - players[me].movement[2]) * speed, 0, (players[me].movement[1] - players[me].movement[0]) * speed).applyQuaternion(new THREE.Quaternion().setFromEuler(temporaryEuler0));
        players[me].collision.velocity = new CANNON.Vec3(temporaryEuler.x, players[me].collision.velocity.y, temporaryEuler.z);
        if (players[me].jumping) {
            speed = 8;
        } else {
            speed = 100;
        }
        if (!dead) {
            if (crouch) {
                player_height = 2.6;
            } else {
                player_height = 4;
            }
        } else {
            players[me].collision.shapes[0].halfExtents.y = 0.7;
            player_height = 1.4;
            players[me].updateCollision();
            PointerLock.unlock();
            try {
                camera.lookAt(players[killer].character.position.x, players[killer].character.position.y, players[killer].character.position.z);
            } catch (e) {};
        }
        walking = !players[me].jumping && players[me].movement[0] || players[me].movement[1] || players[me].movement[2] || players[me].movement[3];
        if (walking) {
            camera_bobbing += 0.1;
        }
        if (dead || paused) {
            players[me].movement[0] = 0;
            players[me].movement[1] = 0;
            players[me].movement[2] = 0;
            players[me].movement[3] = 0;
        }
        if (players[me].collision.shapes[0].halfExtents.y == 0.7 && !dead) {
            players[me].collision.shapes[0].halfExtents.y = 2;
        };
        players[me].updateCollision();

        //head rotation
        players[me].character.children[0].children[0].children[0].children[0].rotation.order = "YXZ";
        if (players[me].health > 0) players[me].character.children[0].children[0].children[0].children[0].rotation.z = THREE.MathUtils.degToRad(rotation.x);
        //body rotation
        players[me].character.children[0].rotation.order = "YXZ";
        if (players[me].health > 0) players[me].character.children[0].rotation.y = THREE.MathUtils.degToRad(rotation.y + 90);
        //body position
        players[me].character.position.set(position.x, position.y, position.z);

        if (settings.thirdPerson) {
            scene.add(players[me].character);
            players[me].character.children[0].children[0].children[0].children[0].scale.set(1, 1, 1);
        } else {
            camera.add(players[me].character);
            players[me].character.position.set(0, -1.5, 0);
            players[me].character.children[0].rotation.y = 1.57079632679;
            players[me].character.children[0].children[0].children[0].children[0].scale.set(0, 0, 0);
        }
    }
    world.step(Math.clamp(delta, 0, 0.6));
}

function packetLoop() {
    if (ws.readyState == 1) ws.send(JSON.stringify({
        x: position.x,
        y: position.y,
        z: position.z,
        rx: rotation.x,
        ry: rotation.y,
        username: username,
        walking: walking,
        crouch: crouch,
        weapon: current_weapon,
        ping: Date.now()
    }));
    setTimeout(packetLoop, 1000 / 60);
}

function error(errormessage) {
    inGame = false;
    PointerLock.unlock();
    var message = document.createElement("div");
    message.style.position = "fixed";
    message.style.left = "33.3%";
    message.style.width = "33.3%";
    message.style.top = "33.3%";
    message.style.height = "33.3%";
    message.style.textAlign = "center";
    message.style.backgroundImage = "url(assets/textures/UI/button.png)";
    message.style.backgroundSize = "100% 100%";
    message.style.border = "solid black 2px";
    message.innerHTML = "<h1>Error</h1>" + errormessage + "<button style='position:absolute;top:80%; height:20%; width: 20%; left: 40%' onclick=location.reload()><h2>close</h2></button>";
    canPause = false;
    document.body.appendChild(message);
    return message;
}

function chatMessage(message) {
    document.getElementById("chat_area").innerText += "\n" + message;
    document.getElementById("chat_area").scrollTo(0, document.getElementById("chat_area").scrollHeight);
}

function sendChatMessage(message) {
    if (message == "") return;
    ws.send(JSON.stringify({
        chatMessage: message,
        username: username
    }));
}

function shootWeapon() {
    if (ammo == 0) return;
    if (!reloading) {
        var tmp = recoil(GAME_WEAPON_TYPES[current_weapon].recoil / ((isScoping && 10) || 1));
    }
    ws.send(JSON.stringify({
        SHOOT_WEAPON: true
    }));
}

function setHealth(health) {
    if (players[me]) {
        if (players[me].health) {
            players[me].health = health;
        }
    }
    document.getElementsByClassName("health_content")[0].style.width = health / 3.80228137 + "%";
    document.getElementsByClassName("health_content")[0].innerHTML = "<h1 style='position: fixed; left: 17%'>" + health + "</h1>";
    dead = (health <= 0);
}

function bullet(position, start) {
    var speed = 10.6;
    var line = new THREE.Mesh(geometry, materials["bullet/bullet"]);
    scene.add(line);
    line.position.set(position.x, position.y, position.z);
    line.lookAt(start.x, start.y, start.z);
    var dist = line.position.distanceTo(new THREE.Vector3(start.x, start.y, start.z));
    line.scale.set(0.001, 0.05, 0.06);
    line.scale.z = dist;
    line.position.add(new THREE.Vector3(0, 0, dist / 2).applyQuaternion(line.quaternion));

    function _0x0f0b() {
        dist -= speed;
        if (dist < 0) {
            line.removeFromParent();
            return;
        }
        line.scale.z -= speed;
        line.position.add(new THREE.Vector3(0, 0, -speed / 2).applyQuaternion(line.quaternion))
        setTimeout(_0x0f0b, 1);
    }
    setTimeout(_0x0f0b, 100);
    settings.sounds && playSound("bullet/fly_by", line).setPlaybackRate(0.8 + Math.random() * 0.4);
    return line;
}

function muzzle_flash(weapon) {
    var flash = new THREE.Mesh(geometry, materials["bullet/muzzle_flash"]);
    flash.rotation.z = Math.random() * 6.28;
    flash.scale.set(0.5, 0.5, 0);
    var point = GAME_WEAPON_TYPES[weapon.type].muzzlePoint;
    flash.position.set(point.x, point.y, point.z);
    weapon.add(flash);
    var _0xf0f2 = 0;

    function _0xf01f() {
        _0xf0f2 += 1;
        flash.scale.x += 0.05;
        flash.scale.y += 0.05;
        if (_0xf0f2 > 10) {
            _0xf0f2 = 0;
            _0x1f31();
            return
        }
        setTimeout(_0xf01f, 1);
    }

    function _0x1f31() {
        _0xf0f2 += 1;
        flash.scale.x -= 0.1;
        flash.scale.y -= 0.1;
        if (_0xf0f2 > 5) {
            _0xf0f2 = 0;
            flash.removeFromParent();
            return
        }
        setTimeout(_0x1f31, 1);
    }
    _0xf01f();
    return flash;
}

function playSound(sound_name, object, position, looped, noPlay) {
    var sound = new THREE.PositionalAudio(listener);
    if (looped) sound.loop = true;
    var audioLoader = new THREE.AudioLoader();
    audioLoader.load("assets/audio/" + sound_name + ".mp3", function(buffer) {
        sound.setBuffer(buffer);
        sound.setRefDistance(5);
        !noPlay && sound.play();
    });
    var object;
    if (!object) {
        object = new THREE.Object3D();
        position && object.position.set(position.x, position.y, position.z);
        scene.add(object);
        sound.onEnded = function() {
            this.isPlaying = false;
            object.removeFromParent();
        }
    }
    object.add(sound);
    return sound;
}

function offset_camera(x, y, z) {
    camera.rotation.copy(new THREE.Euler(Math.clamp(camera.rotation.x + THREE.MathUtils.degToRad(x || 0), -Math.PI / 2, Math.PI / 2), camera.rotation.y + THREE.MathUtils.degToRad(y || 0), camera.rotation.z + THREE.MathUtils.degToRad(z || 0)));
    camera.rotation.order = "YXZ";
}

function recoil(a) {
    var counter = 0;
    var switch_ = false;
    var recoil_amount = 0;

    function _0x102() {
        if (counter > 20) {
            if (switch_ || automatic_shooting) return;
            counter = 2;
            switch_ = true;
        };
        counter += (switch_ && 0.5) || 1;
        recoil_amount += (switch_ && -a / 40) || a / 20;
        offset_camera((switch_ && -a / 40) || a / 20, !isScoping && Math.random() / 20 - 0.025 || Math.random() / 100 - 0.005);
        setTimeout(_0x102, 1);
    }
    _0x102();
    return (recoil_amount)
}

function undorecoil(a) {
    var counter = 0;

    function _0x102() {
        if (counter > 50) return;
        counter += 1;
        offset_camera(-a / 2.5);
        setTimeout(_0x102, 1);
    }
    _0x102();
}

function showPatchnotes() {
    var e = error("");
    e.childNodes[0].innerHTML = "Patchnotes";
    e.childNodes[1].onclick = function() {
        e.outerHTML = "";
    }
    var p = document.createElement("p");
    p.style.overflowY = "scroll";
    p.style.height = "50%";
    e.appendChild(p);

    //v1.0.0_beta1
    p.innerHTML += "<b>version 1.0.0_beta1</b> - Overhauled the map system, overhauled the menu, added an integrated server for client-side testing, cleaned up and improved game's code (including the crappy math), improved server admin commands and configuration file, and added an ENITRE UNITY-LIKE MAP EDITOR COMPLETE WITH IMPORTING, EXPORTING, SAVING, LOADING, UNDO AND REDO!!!<br>";
    //v1.0.0_alpha5
    p.innerHTML += "<b>version 1.0.0_alpha5</b> - Added a skybox, improved the map system, overhauled the first person perspective, improved the HUD, added hitbox view (\\), added more admin commands, great physics improvements for playability on slower devices, as well as an invisible wall to prevent the anticheat from falsely flagging people.<br>";
    //v1.0.0_alpha4
    p.innerHTML += "<b>version 1.0.0_alpha4</b> - Added more sounds, improved anticheat, improved the false-positive situation, added server-side admin commands, added the M24, patched HTML elements in the leaderboard, stats open as a window, and game settings save now.<br>";
    //v1.0.0_alpha3
    p.innerHTML += "<b>version 1.0.0_alpha3</b> - Improved the statistics page a lot, patched annoying bugs, added pause menu and settings, improved anti-cheat, minor map additions, a sound system with some walking sounds, and added a REAL leaderboard with first, second and third places that are based on kills.";
}

function showStats() {
    e = error("");
    e.id = "stat"
    e.childNodes[0].outerHTML = "";
    e.innerHTML = "<iframe src='stats.html' style='width:100%; height: 100%; border: none;' scrolling='no'></iframe>";
    e.style.height = "50%";
}

function showDeveloperTools() {
    var e = error("");
    e.childNodes[0].innerHTML = "Developer Tools";
    e.childNodes[1].onclick = function() {
        e.outerHTML = "";
    }
    e.style.height = "40%"
    var p = document.createElement("p");
    p.style.height = "50%";
    e.appendChild(p);
    p.innerHTML = "<a href='editor.html' target='_blank'><button style='width: 20%; margin-left:-10%'><h1>Map Editor</h1></button></a><button style='width: 20%; margin-left:-10%; margin-top: 5%;' onclick='this.parentElement.parentElement.children[1].click();showIntegratedServer();'><h1>Integrated Server</h1></button>";
}

function showIntegratedServer() {
    var e = error("");
    e.childNodes[0].innerHTML = "Integrated Server";
    e.childNodes[1].onclick = function() {
        e.outerHTML = "";
    }
    e.style.height = "40%"
    var p = document.createElement("p");
    p.style.height = "50%";
    e.appendChild(p);
    p.innerHTML = "<div><input type='checkbox' id='consoleEnabled' checked=true></input>Console window</div><button style='width: 20%; margin-left:-10%; margin-top: 5%' onclick='initialize(integrated_server.init(!document.getElementById(`consoleEnabled`).checked));this.parentElement.parentElement.children[1].click();'><h3>Start integrated server</h3></button>";
}

function createMenuPlayer() {
    var player = new Player("", him);
    player.character.rotation.y = -1.57079632679;
    player.playAnimation("char.idle");
    player.character.children[1].visible = false;
    player.character.rotation.y = 5;
    secondary_scene.add(players[him].character);
    return player;
}

function initialize(server) {
    document.getElementsByClassName("loading")[0].style.display = "block";
    if (!server) {
        window.ws = new WebSocket(PROTOCOL + '://' + CONFIG_SERVER + ':7071/ws');
    } else {
        window.ws = server;
    }
    secondary_renderer.domElement.style.display = "none";
    packetLoop();
    ws.onerror = function() {
        error("The server that you tried to connect to has gone down.");
        if (!localStorage.disconnect) localStorage.disconnect = "0";
        localStorage.disconnect = JSON.stringify(Number(localStorage.disconnect) + 1);
    }
    ws.onmessage = function(data) {
        var data = JSON.parse(data.data);
        if (data.disconnect_user) {
            if (data.disconnect_user == me) {
                reason = "Kicked from game. Reason: " + data.reason;
                if (!localStorage.disconnect) localStorage.disconnect = "0";
                localStorage.disconnect = JSON.stringify(Number(localStorage.disconnect) + 1);
                disconnected = true;
                ws.close();
                return
            } else {
                chatMessage(data.username + " " + data.reason);
            }
            players[data.disconnect_user].delete();
            return
        }
        if (data.chatMessage) {
            chatMessage(data.username + ": " + data.chatMessage);
            return
        }
        if (data.jump) {
            players[data.jump].playAnimation("movement.jump", true);
            return
        }
        if (data.SHOOT_WEAPON) {
            if (data.SHOOT_WEAPON.position) {
                var pos = new THREE.Vector3();
                players[data.attacker].weapon.getWorldPosition(pos);
                var offset = GAME_WEAPON_TYPES[players[data.attacker].weapon.type].muzzlePoint;
                var quat = new THREE.Quaternion();
                players[data.attacker].weapon.getWorldQuaternion(quat);
                pos.add(new THREE.Vector3(offset.x, offset.y, offset.z).applyQuaternion(quat));
                bullet(data.SHOOT_WEAPON.position, pos);
                muzzle_flash(players[data.attacker].weapon);
                settings.sounds && playSound("weapon/shoot/" + players[data.attacker].weapon.type, players[data.attacker].weapon);
                settings.sounds && playSound("bullet/" + data.SHOOT_WEAPON.material + (Math.round(Math.random() * 2) + 1), false, new THREE.Vector3(data.SHOOT_WEAPON.position.x, data.SHOOT_WEAPON.position.y, data.SHOOT_WEAPON.position.z)).setVolume(0.4);
                if (!data.isPlayer) {
                    fogEffect(new THREE.Vector3(data.SHOOT_WEAPON.position.x, data.SHOOT_WEAPON.position.y, data.SHOOT_WEAPON.position.z));
                    if (data.SHOOT_WEAPON.normal) spawnDecal(new THREE.Vector3(data.SHOOT_WEAPON.position.x, data.SHOOT_WEAPON.position.y, data.SHOOT_WEAPON.position.z), new THREE.Vector3(data.SHOOT_WEAPON.normal.x, data.SHOOT_WEAPON.normal.y, data.SHOOT_WEAPON.normal.z));
                    collideEffect(new THREE.Vector3(data.SHOOT_WEAPON.position.x, data.SHOOT_WEAPON.position.y, data.SHOOT_WEAPON.position.z), data.SHOOT_WEAPON.material);
                } else {
                    if (data.attacker == me) {
                        document.getElementById("hitmarker").style.display = "block";
                        setTimeout('document.getElementById("hitmarker").style.display = "none";', 400);
                        if (data.headshot) {
                            var material = new THREE.SpriteMaterial({
                                map: new THREE.TextureLoader().load('assets/textures/hitmarkers/hitmarker_headshot.png')
                            });
                            var sprite = new THREE.Sprite(material);
                            scene.add(sprite);
                            sprite.scale.set(5, 5, 5);
                            sprite.position.set(players[data.isPlayer].character.position.x, players[data.isPlayer].character.position.y + 2.5, players[data.isPlayer].character.position.z);

                            function _0x0bf() {
                                if (sprite.scale.x - 0.01 <= 0) {
                                    sprite.removeFromParent();
                                    return;
                                }
                                sprite.position.y += 0.03;
                                sprite.scale.x -= 0.02;
                                sprite.scale.y -= 0.02;
                                sprite.scale.z -= 0.02;
                                setTimeout(_0x0bf, 1);
                            }
                            _0x0bf();
                        }
                    }
                    players[data.isPlayer].playAnimation("char.damage" + Math.round(Math.random() + 1), true);
                    if (data.isPlayer == me && !damage_cooldown) {
                        document.getElementsByClassName("damage_overlay")[0].style.opacity = 1;
                        damage_cooldown = true;
                        setTimeout('document.getElementsByClassName("damage_overlay")[0].style.opacity = 0; damage_cooldown = false;', 350);
                        var _0xf0f1 = 0;

                        function _0xf1f0() {
                            _0xf0f1++;
                            if (_0xf0f1 > 20) {
                                camera_damage = 0
                                return;
                            }
                            camera_damage = Math.random() / 10 - 0.05;
                            setTimeout(_0xf1f0, 1);
                        }
                        _0xf1f0();
                    }
                }
                players[data.attacker].playAnimation("weapon.shoot." + players[data.attacker].weapon.type, true, false, 1000);
            }
            return
        }
        if (data.RELOAD_WEAPON) {
            players[data.RELOAD_WEAPON].weapon.reload();
            settings.sounds && playSound("weapon/reload/" + players[data.RELOAD_WEAPON].weapon.type, players[data.RELOAD_WEAPON].weapon);
            if (data.RELOAD_WEAPON == me) {
                reloading = true;
                setTimeout("reloading = false", GAME_WEAPON_TYPES[current_weapon].reloadTime * 1000 + 10);
                document.onmouseup({
                    reload: true
                });
            }
            return
        }
        if (data.death) {
            players[data.death].playAnimation("char.death", true, false, 1000, true);
            if (players[data.death].weapon) players[data.death].weapon.rotation.set(90 * 57.29577951308232, 0, 0);
            if (players[data.killer]) {
                //players[data.killer].kills++;
                chatMessage(players[data.death].username + " was killed by " + players[data.killer].username);
                if (data.death == me) {
                    canPause = false;
                    killer = data.killer;
                    if (!localStorage.deaths) localStorage.deaths = "0";
                    localStorage.deaths = JSON.stringify(Number(localStorage.deaths) + 1);
                }
                if (data.killer == me) {
                    if (!localStorage.kills) localStorage.kills = "0";
                    localStorage.kills = JSON.stringify(Number(localStorage.kills) + 1);
                }
            } else {
                chatMessage(players[data.death].username + " died mysteriously");
            }
            return
        }
        if (data.respawn) {
            if (data.respawn == me) canPause = false;
            players[data.respawn].stopAnimation("char.death");
            players[data.respawn].weapon && players[data.respawn].weapon.quaternion.copy(players[data.respawn].weapon.quat);
            return
        }
        if (data.teleport) {
            players[me].collision.position.set(data.teleport.x, data.teleport.y, data.teleport.z);
            setTimeout(function() {
                ws.send(JSON.stringify({
                    teleported: true
                }))
            }, 100);
            return
        }
        if (data.pong) {
            ping = Date.now() - data.pong;
            document.getElementById("ping_text").innerHTML = ping + " ms ping"
            return;
        }
        if (data.map) {
            loadMap(data.map);
            return;
        }
        me = data.me;
        if (me == data.sender) {
            setHealth(data.health);
            document.getElementById("ammo_text").innerHTML = data.ammo;
            ammo = data.ammo;
        }
        var player = players[data.sender];
        if (!player) {
            player = new Player(data.username, data.sender);
            chatMessage(data.username + " joined");
        }

        //player visibility
        player.character.children[0].children[3].visible = !player.isMe || settings.thirdPerson || (settings.arms && !dead);

        if (!player.isMe) {
            world.removeBody(player.collision);
        } else {
            world.addBody(player.collision);
        }
        if (data.walking) {
            player.walking = true;
            raycaster.set(player.position, new THREE.Vector3(0, -1, 0));
            var hit = raycaster.intersectObject(scene.children[3]);
            if (hit[0] && hit[0].distance < 2.09) {
                if (!player.walkSounds[hit[0].object.MATERIAL]) {
                    player.walkSounds[hit[0].object.MATERIAL] = playSound("walk_" + hit[0].object.MATERIAL, this.character, false, true);
                }
                Object.values(player.walkSounds).forEach(function(sound) {
                    sound.setVolume(0);
                });
                player.walkSounds[hit[0].object.MATERIAL].setVolume(1 && settings.sounds);
            }
            player.playAnimation("movement.walk", false, true);
            player.stopAnimation("movement.idle");
        } else {
            player.walking = false;
            Object.values(player.walkSounds).forEach(function(sound) {
                sound.setVolume(0);
            });
            player.stopAnimation("movement.walk");
            player.playAnimation("char.idle", false, true);
        }
        if (data.crouch) {
            player.playAnimation("movement.crouch", false, true);
        } else {
            player.stopAnimation("movement.crouch");
        }
        player.health = data.health;
        var doContinue = true;
        if (data.weapon == "NONE") {
            if (player.weapon && player.weapon && player.weapon.type != data.weapon) {
                player.stopAnimation("weapon.hold." + player.weapon.type);
                player.stopAnimation("weapon.scope." + player.weapon.type);
                player.weapon.removeFromParent();
            }
            player.weapon = undefined;
        } else {
            if (player.weapon && (data.weapon == player.weapon.type)) doContinue = false;
            if (data.weapon && player.weapon && player.weapon.type != data.weapon) {
                player.stopAnimation("weapon.hold." + player.weapon.type);
                player.stopAnimation("weapon.scope." + player.weapon.type);
                player.weapon.removeFromParent();
            }
            if (doContinue) {
                player.setWeapon(data);
            }
            //player.weapon.visible = (player.health > 0);
            if (player.health > 0) {
                player.playAnimation("weapon.hold." + player.weapon.type, false, true, 1000);
            } else {
                player.stopAnimation("weapon.hold." + player.weapon.type);
            }
        }
        player.kills = data.kills;
        if (data.sender != me) {
            //head rotation
            player.character.children[0].children[0].children[0].children[0].rotation.order = "YXZ";
            if (player.health > 0) player.character.children[0].children[0].children[0].children[0].rotation.z = THREE.MathUtils.degToRad(data.rx);
            //body rotation
            player.character.rotation.order = "YXZ";
            if (player.health > 0) player.character.rotation.y = THREE.MathUtils.degToRad(data.ry + 90);
            //body position
            player.character.position.set(data.x, data.y, data.z);
        }
        player.position.set(data.x, data.y, data.z);
    }
    ws.onopen = function() {
        if (!localStorage.joins) localStorage.joins = "0";
        localStorage.joins = JSON.stringify(Number(localStorage.joins) + 1);
        inGame = true;
    }
    document.getElementsByClassName("game_menu")[0].style.display = "none";

    //load settings
    settings.thirdPerson = localStorage.third_person == "true";
    settings.nametags = localStorage.nametags == "true";
    settings.ping = localStorage.ping == "true";
    settings.sounds = localStorage.sounds == "true" || (localStorage.sounds != "true" && localStorage.sounds != "false");
    settings.FOV = Number(localStorage.fov) || 100;
    settings.arms = localStorage.arms == "true" || (localStorage.sounds != "true" && localStorage.sounds != "false");

    //apply them on the menu
    document.getElementById("third_person").checked = settings.thirdPerson;
    document.getElementById("nametags").checked = settings.nametags;
    document.getElementById("ping").checked = settings.ping;
    document.getElementById("sounds").checked = settings.sounds;
    document.getElementById("fov").value = settings.FOV
    document.getElementById("arms").checked = settings.arms;
    camera.fov = Number(document.getElementById('fov').value);

    renderer.domElement.onmousedown = function(event) {
        if (inGame) {
            PointerLock.lock();
            canPause = true;
        }
        if (dead) return;
        if (event.button == 2 && current_weapon != "NONE") {
            isScoping = true;
            camera.oldfov = camera.fov;
            camera.fov = GAME_WEAPON_TYPES[current_weapon].zoomfov;
            if (settings.FOV < camera.fov) camera.fov = settings.FOV;
            return
        }
        if (current_weapon != "NONE" && PointerLock.isLocked && !GAME_WEAPON_TYPES[current_weapon].automatic) shootWeapon();
        if (current_weapon != "NONE" && PointerLock.isLocked && GAME_WEAPON_TYPES[current_weapon].automatic) {
            automatic_shooting = true;
            old_ = rotation.x;
        }
    }
    document.onmouseup = function(event) {
        if (event.button == 2 && current_weapon != "NONE") {
            isScoping = false;
            camera.fov = camera.oldfov;
            return
        }
        if (current_weapon != "NONE" && GAME_WEAPON_TYPES[current_weapon].automatic && automatic_shooting) {
            undorecoil(Math.clamp(-(old_ - rotation.x) / 20 * 0.9, 0, Infinity)); //undo 90 percent of recoil!
        }
        if (!event.reload) automatic_shooting = false;
    }
}
onload = function() {
    document.getElementById("username").value = "player" + Math.round(Math.random() * 1000);
    renderer.render(scene, camera);
    createMenuPlayer();
    mainLoop();
    //load map
    ///////////////////////
    loadMap(window.CONFIG_MAP || "map_arena")
    ///////////////////////

    //initialization arguments
    var arguments_ = new URLSearchParams(location.search);
    var noconsole = false;
    var server_copy_client_map = false;
    if (arguments_.get("noconsole")) {
        noconsole = JSON.parse(arguments_.get("noconsole"));
    }
    if (arguments_.get("server_copy_client_map")) {
        server_copy_client_map = JSON.parse(arguments_.get("server_copy_client_map"));
    }
    if (arguments_.get("integrated_server")) {
        initialize(integrated_server.init(noconsole));
        //force server to load our map if wanted
        server_copy_client_map && setTimeout(function() {
            integrated_server.server.worker.postMessage(JSON.stringify({
                eval: "loadMap(" + JSON.stringify(JSON.stringify(map_data)) + ", scene, geometry);"
            }))
        }, 1000);
    }
}
document.onkeydown = function(key) {
    if (!inGame || dead) return
    if (key.key == "/") {
        PointerLock.unlock();
        setTimeout(function() {
            document.getElementById("talk").focus()
        }, 0);
    }
    if (key.key == "Enter" && document.activeElement == document.getElementById("talk")) {
        PointerLock.lock();
        document.getElementById("talk").blur();
        sendChatMessage(document.getElementById("talk").value);
        document.getElementById("talk").value = "";
    }
    if (document.activeElement == document.getElementById("talk")) return
    if (key.code == "KeyW") {
        players[me].movement[0] = 1;
    }
    if (key.code == "KeyA") {
        players[me].movement[2] = 1;
    }
    if (key.code == "KeyS") {
        players[me].movement[1] = 1;
    }
    if (key.code == "KeyD") {
        players[me].movement[3] = 1;
    }
    if (key.key == " ") {
        players[me].jump();
    }
    if (key.code == "ShiftLeft") {
        crouch = true;
    }
    if (key.code == "KeyR") {
        if (players[me].weapon == "NONE") return;
        ws.send(JSON.stringify({
            RELOAD_WEAPON: true
        }));
    }
    if (key.code == "KeyL") {
        PointerLock.lock();
    }
    if (key.code == "Backslash") {
        settings.hitbox = !settings.hitbox;
    }
    if (reloading) return;
    if (key.code == "Digit1") {
        current_weapon = "AK-47";
    }
    if (key.code == "Digit2") {
        current_weapon = "Pistol";
    }
    if (key.code == "Digit3") {
        current_weapon = "M24";
    }
    if (key.code == "Digit4") {
        current_weapon = "NONE";
    }
}
document.onkeyup = function(key) {
    if (document.activeElement == document.getElementById("talk") || dead) return
    if (!inGame) return
    if (key.code == "KeyW") {
        players[me].movement[0] = 0;
    }
    if (key.code == "KeyA") {
        players[me].movement[2] = 0;
    }
    if (key.code == "KeyS") {
        players[me].movement[1] = 0;
    }
    if (key.code == "KeyD") {
        players[me].movement[3] = 0;
    }
    if (key.code == "ShiftLeft") {
        crouch = false;
    }
}
secondary_renderer.domElement.onmouseover = function() {
    players[him].weapon && secondary_renderer.domElement.onmouseleave;
    players[him].setWeapon({
        weapon: Object.keys(GAME_WEAPON_TYPES)[Math.floor(Math.random() * Object.values(GAME_WEAPON_TYPES).length)]
    });
    players[him].playAnimation("weapon.hold." + players[him].weapon.type, false, false, 1000);
}
secondary_renderer.domElement.onmouseleave = function() {
    players[him].weapon.removeFromParent();
    players[him].stopAnimation("weapon.hold." + players[him].weapon.type);
    players[him].weapon = undefined;
}
window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight;
    renderer.setSize(window.innerWidth, window.innerHeight);
});
document.body.addEventListener("wheel", function(event) {
    if (!settings.thirdPerson) return
    settings.thirdPersonZoom += event.deltaY / 1000;
    if (settings.thirdPersonZoom < 0.2) settings.thirdPersonZoom = 0.2;
    if (settings.thirdPersonZoom > 3) settings.thirdPersonZoom = 3;
});
document.getElementById('fov').onchange = function() {
    setTimeout(function() {
        camera.fov = Number(document.getElementById('fov').value)
    }, 10);
}
console.log("PIXEL ARENA " + version);
document.getElementById("version").innerHTML = "version " + version;
