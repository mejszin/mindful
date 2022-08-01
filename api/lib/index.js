const express = require('express');
const app = express();
var bodyParser = require('body-parser');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.locals.jsonParser = bodyParser.json()
app.locals.urlencodedParser = bodyParser.urlencoded({ extended: true })

const PORT = 85;

const VERSION = 'v0.0.1';

const fs = require('fs');
const user_data_path = './data/users.json';
var user_data = fs.existsSync(user_data_path) ? JSON.parse(fs.readFileSync(user_data_path)) : {};
const game_data_path = './data/game.json';
var game_data = fs.existsSync(user_data_path) ? JSON.parse(fs.readFileSync(game_data_path)) : {};

const bcrypt = require('bcrypt');

const methods = {};

methods.randomString = (length = 8) => {
    var char_set = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var id = '';
    for (var i = 0; i < length; i++) {
        id += char_set.charAt(
            Math.floor(Math.random() * char_set.length)
        );
    }
    return id;
}

methods.writeUsers = () => {
    fs.writeFileSync(user_data_path, JSON.stringify(user_data));
}

methods.writeGame = () => {
    fs.writeFileSync(game_data_path, JSON.stringify(game_data));
}

methods.isToken = (token) => {
    return (token in user_data);
}

methods.isUser = (user_id) => {
    // TODO:
    return true;
}

methods.newSaltHash = (password) => {
    return new Promise((resolve, reject) => {
        bcrypt.genSalt(10, (err, salt) => {
            bcrypt.hash(password, salt, function(err, hash) {
                resolve([salt, hash]);
            });
        })
    });
};

methods.createUser = async (username, password) => {
    if (methods.usernameExists(username)) { return undefined };
    var token = methods.randomString();
    var user_id = methods.randomString();
    var salt_hash = await methods.newSaltHash(password);
    user_data[token] = {
        id: user_id,
        alias: username,
        username: username,
        password: {
            salt: salt_hash[0],
            hash: salt_hash[1]
        },
        tasks: {},
        habits: {}
    };
    console.log(user_data[token]);
    game_data.players[user_id] = {
        username: username,
        position: [null, 0, 0], // [area, x, y]
    }
    return token;
}

methods.getUser = (token, user_id = null) => {
    if (token in user_data) {
        if (user_id == null) {
            return user_data[token];
        } else {
            // TODO: Search for user_id
            return undefined;
        }
    } else {
        return undefined;
    }
}

methods.usernameExists = (username) => {
    var exists = false;
    Object.keys(user_data).forEach(function(token) {
        if (username == user_data[token].username) {
            console.log('Username', username, 'is already in use.')
            exists = true;
        };
    })
    return exists;
};

// methods.comparePassword = async (password, hash) {
//     const result = await bcrypt.compare(password, hash);
//     return result;
// }

methods.findCredentials = async (username, password) => {
    return new Promise((resolve, reject) => {
        Object.keys(user_data).forEach(async function(token) {
            if (username == user_data[token].username) {
                const result = await bcrypt.compare(password, user_data[token].password.hash);
                resolve(result ? token : null);
            } else {
                resolve(null);
            }
        });
    });
};

methods.getGamePlayer = (user_id) => {
    if (user_id in game_data.players) {
        return game_data.players[user_id];
    } else {
        return undefined;
    }
}

methods.setGamePlayerPosition = (user_id, area, x, y) => {
    if (user_id in game_data.players) {
        game_data.players[user_id].position = [area, x, y];
        return true;
    } else {
        return false;
    }
}

methods.setGameArea = (area_id, data) => {
    game_data.areas[area_id] = data;
    return true;
}

methods.getGameArea = (area_id) => {
    if (area_id in game_data.areas) {
        return game_data.areas[area_id];
    } else {
        return undefined;
    }
}

methods.setGameTile = (tile_id, data) => {
    game_data.tiles[tile_id] = data;
    return true;
}

methods.getGameTile = (tile_id) => {
    if (tile_id in game_data.tiles) {
        return game_data.tiles[tile_id];
    } else {
        return undefined;
    }
}

methods.listGameTile = () => {
    return Object.keys(game_data.tiles);
}

methods.addHabit = (token, name, days) => {
    if (methods.isToken(token)) {
        var habit_id = methods.randomString();
        user_data[token].habits[habit_id] = {
            name: name,
            days: days, // { 'MON': target, ... }
            history: [] // [[date, achieved, target], ...]
        };
        return habit_id;
    }
}

app.get('/ping', (req, res) => {
    console.log('/ping', req.query);
    res.status(200).send('Pong!');
});

app.get('/user/get', (req, res) => {
    console.log('/user/get', req.query);
    const { token } = req.query;
    if (methods.isToken(token)) {
        // Success
        res.status(200).send(methods.getUser(token));
    } else {
        // Unauthorized
        res.status(401).send();
    }
});

app.get('/user/login', async (req, res) => {
    console.log('/user/login', req.query);
    const { username, password } = req.query;
    if (methods.usernameExists(username)) {
        var token = await methods.findCredentials(username, password);
    } else {
        var token = null;
    }
    if (token != null) {
        // Success
        res.status(200).send({ token: token });
    } else {
        // Unauthorized
        res.status(401).send();
    }
});

app.get('/user/new', async (req, res) => {
    console.log('/user/new', req.query);
    const { username, password } = req.query;
    if ((username != undefined) && (password != undefined)) {
        var token = await methods.createUser(username, password);
        if (token != undefined) {
            // Success
            methods.writeUsers();
            methods.writeGame();
            res.status(200).send({ token: token });
        } else {
            res.status(204).send();
        }
    } else {
        // Bad request
        res.status(400).send();
    }
});

app.get('/user/habit/new', (req, res) => {
    console.log('/user/habit/new', req.query);
    const { token, name, mon, tue, wed, thu, fri, sat, sun } = req.query;
    if (methods.isToken(token)) {
        // Success
        var days = { 
            'MON': mon, 'TUE': tue, 'WED': wed, 'THU': thu, 'FRI': fri,
            'SAT': sat, 'SUN': sun
        };
        var habit_id = methods.addHabit(token, name, days);
        methods.writeUsers();
        res.status(200).send(habit_id);
    } else {
        // Unauthorized
        res.status(401).send();
    }
});

app.post('/game/tile/set', (req, res) => {
    console.log('/game/tile/set', req.query);
    const { token, id } = req.query;
    const data = req.body;
    if (methods.isToken(token)) {
        // Success
        methods.setGameTile(id, data);
        methods.writeGame();
        res.status(200).send();
    } else {
        // Unauthorized
        res.status(401).send();
    }
});

app.get('/game/tile/get', (req, res) => {
    console.log('/game/tile/get', req.query);
    const { token, id } = req.query;
    if (methods.isToken(token)) {
        // Success
        let tile = methods.getGameTile(id);
        if (tile !== undefined) {
            res.status(200).send(tile);
        } else {
            res.status(204).send();
        }
    } else {
        // Unauthorized
        res.status(401).send();
    }
});

app.get('/game/tile/list', (req, res) => {
    console.log('/game/tile/list', req.query);
    const { token } = req.query;
    if (methods.isToken(token)) {
        // Success
        res.status(200).send(methods.listGameTile());
    } else {
        // Unauthorized
        res.status(401).send();
    }
});

app.post('/game/area/set', (req, res) => {
    console.log('/game/area/set', req.query);
    const { token, id } = req.query;
    const data = req.body;
    if (methods.isToken(token)) {
        // Success
        methods.setGameArea(id, data);
        methods.writeGame();
        res.status(200).send();
    } else {
        // Unauthorized
        res.status(401).send();
    }
});

app.get('/game/area/get', (req, res) => {
    console.log('/game/area/get', req.query);
    const { token, id } = req.query;
    if (methods.isToken(token)) {
        // Success
        let area = methods.getGameArea(id);
        if (area !== undefined) {
            res.status(200).send(area);
        } else {
            res.status(204).send();
        }
    } else {
        // Unauthorized
        res.status(401).send();
    }
});

app.get('/game/player/get', (req, res) => {
    console.log('/game/player/get', req.query);
    const { token, id } = req.query;
    if (methods.isToken(token)) {
        // Success
        let player = methods.getGamePlayer(id);
        if (player !== undefined) {
            res.status(200).send(player);
        } else {
            res.status(204).send();
        }
    } else {
        // Unauthorized
        res.status(401).send();
    }
});

app.get('/game/player/position/get', (req, res) => {
    console.log('/game/player/position/get', req.query);
    const { token, id } = req.query;
    if (methods.isToken(token)) {
        // Success
        let player = methods.getGamePlayer(id);
        if (player !== undefined) {
            res.status(200).send(player.position);
        } else {
            res.status(204).send();
        }
    } else {
        // Unauthorized
        res.status(401).send();
    }
});

app.get('/game/player/position/set', (req, res) => {
    console.log('/game/player/position/set', req.query);
    const { token, area, x, y } = req.query;
    if (methods.isToken(token)) {
        methods.setGamePlayerPosition(methods.getUser(token).id, area, x, y);
        methods.writeGame();
        res.status(200).send(true);
    } else {
        // Unauthorized
        res.status(401).send();
    }
});

app.listen(PORT, () => console.log(`It's alive on port ${PORT}!`));