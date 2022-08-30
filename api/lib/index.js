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
const project_data_path = './data/projects.json';
var project_data = fs.existsSync(user_data_path) ? JSON.parse(fs.readFileSync(project_data_path)) : {};

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

methods.writeProjects = () => {
    fs.writeFileSync(project_data_path, JSON.stringify(project_data));
}

methods.isToken = (token) => {
    return (token in user_data);
}

methods.isUser = (user_id) => {
    // TODO:
    return true;
}

methods.newSaltHash = (password) => {
    return new Promise((resolve) => {
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
        }
    };
    console.log(user_data[token]);
    game_data.players[user_id] = {
        username: username,
        position: [null, 0, 0], // [area, x, y]
    }
    project_data.users[user_id] = {
        username: username,
        activity: {},
        tags: {},
        entries: {}
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
            exists = true;
        };
    })
    return exists;
};

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

methods.getProjectUser = (user_id) => {
    if (user_id in project_data.users) {
        return project_data.users[user_id];
    } else {
        return undefined;
    }
}

methods.getUserTagIndex = (user_id, tag) => {
    Object.keys(project_data.users[user_id].tags).forEach(tag_id => {
        if (project_data.users[user_id].tags[tag_id][0] == tag) {
            return tag_id;
        }
    });
    return -1;
}

methods.newUserTag = (user_id, tag) => {
    let tag_id = Object.keys(project_data.users[user_id].tags).length.toString();
    project_data.users[user_id].tags[tag_id] = [tag, '#D3D3D3'];
    return tag_id;
}

methods.newProjectEntry = (token, data) => {
    var user_id = user_data[token].id;
    var entry_id = methods.randomString(4);
    console.log('newProjectEntry()', 'user_id=', user_id, 'entry_id=', entry_id);
    let tag_indices = []
    data.tags.forEach(tag => {
        let tag_index = methods.getUserTagIndex(user_id, tag);
        if (tag_index == -1) {
            tag_index = methods.newUserTag(user_id, tag);
        }
        tag_indices.push(tag_index.toString());
    });
    project_data.users[user_id].entries[entry_id] = data;
    project_data.users[user_id].entries[entry_id].tags = tag_indices;
}

methods.newProjectEntryFeed = (token, entry_id, data) => {
    var user_id = user_data[token].id;
    if (entry_id in project_data.users[user_id].entries) {
        if ('feed' in project_data.users[user_id].entries[entry_id]) {
            project_data.users[user_id].entries[entry_id].feed.push(data);
        } else {
            project_data.users[user_id].entries[entry_id].feed = [data]
        }
    }
}

methods.setProjectEntryFeed = (token, entry_id, index, data) => {
    var user_id = user_data[token].id;
    if (entry_id in project_data.users[user_id].entries) {
        project_data.users[user_id].entries[entry_id].feed[index] = data;
    }
}

methods.setProjectEntryVariable = (token, entry_id, variable, value) => {
    var user_id = user_data[token].id;
    if (entry_id in project_data.users[user_id].entries) {
        if ('variables' in project_data.users[user_id].entries[entry_id]) {
            project_data.users[user_id].entries[entry_id].variables[variable] = value;
        } else {
            project_data.users[user_id].entries[entry_id].variables = {
                [variable]: value
            }
        }
    }
}

methods.newProjectEntryDatapoint = (token, entry_id, dataset, value) => {
    var user_id = user_data[token].id;
    if (entry_id in project_data.users[user_id].entries) {
        if ('variables' in project_data.users[user_id].entries[entry_id]) {
            if (dataset in project_data.users[user_id].entries[entry_id].variables) {
                project_data.users[user_id].entries[entry_id].variables[dataset].push(value);
            } else {
                project_data.users[user_id].entries[entry_id].variables[dataset] = [value];
            }
        } else {
            project_data.users[user_id].entries[entry_id].variables = {
                [dataset]: [value]
            }
        }
    }
}

methods.incrementProjectActivity = (token) => {
    var user_id = user_data[token].id;
    var today = new Date();
    today = `${today.getFullYear()}_${today.getMonth() + 1}_${today.getDate()}`
    if (today in project_data.users[user_id].activity) {
        project_data.users[user_id].activity[today] += 1;
    } else {
        project_data.users[user_id].activity[today] = 1;
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

methods.addHabit = (token, name, days) => { // TODO: Remove
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
        var user = methods.getUser(token);
        res.status(200).send({ id: user.id, token: token });
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
            methods.writeProjects();
            res.status(200).send({ token: token });
        } else {
            res.status(204).send();
        }
    } else {
        // Bad request
        res.status(400).send();
    }
});

app.get('/user/habit/new', (req, res) => { // TODO: Remove
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

app.get('/projects/get', (req, res) => {
    console.log('/projects/get', req.query);
    const { token, id } = req.query;
    if (methods.isToken(token)) {
        // Success
        let data = methods.getProjectUser(id);
        if (data !== undefined) {
            res.status(200).send(data.entries);
        } else {
            res.status(204).send();
        }
    } else {
        // Unauthorized
        res.status(401).send();
    }
});

app.get('/projects/tags/get', (req, res) => {
    console.log('/projects/tags/get', req.query);
    const { token, id } = req.query;
    if (methods.isToken(token)) {
        // Success
        let data = methods.getProjectUser(id);
        if (data !== undefined) {
            res.status(200).send(data.tags);
        } else {
            res.status(204).send();
        }
    } else {
        // Unauthorized
        res.status(401).send();
    }
});

app.get('/projects/activity/get', (req, res) => {
    console.log('/projects/activity/get', req.query);
    const { token, id } = req.query;
    if (methods.isToken(token)) {
        // Success
        let data = methods.getProjectUser(id);
        if (data !== undefined) {
            res.status(200).send(data.activity);
        } else {
            res.status(204).send();
        }
    } else {
        // Unauthorized
        res.status(401).send();
    }
});


app.post('/projects/entry/new', (req, res) => {
    console.log('/projects/entry/new', req.query);
    const { token } = req.query;
    const data = req.body;
    if (methods.isToken(token)) {
        // Success
        methods.newProjectEntry(token, data);
        methods.incrementProjectActivity(token);
        methods.writeProjects();
        res.status(200).send();
    } else {
        // Unauthorized
        res.status(401).send();
    }
});

app.post('/projects/entry/feed/new', (req, res) => {
    console.log('/projects/entry/feed/new', req.query);
    const { token, entry } = req.query;
    const data = req.body;
    if (methods.isToken(token)) {
        // Success
        methods.newProjectEntryFeed(token, entry, data);
        methods.incrementProjectActivity(token);
        methods.writeProjects();
        res.status(200).send();
    } else {
        // Unauthorized
        res.status(401).send();
    }
});

app.post('/projects/entry/feed/set', (req, res) => {
    console.log('/projects/entry/feed/set', req.query);
    const { token, entry, index } = req.query;
    const data = req.body;
    console.log(data);
    if (methods.isToken(token)) {
        // Success
        methods.setProjectEntryFeed(token, entry, parseInt(index), data);
        methods.incrementProjectActivity(token);
        methods.writeProjects();
        res.status(200).send();
    } else {
        // Unauthorized
        res.status(401).send();
    }
});

app.get('/projects/entry/variable/set', (req, res) => {
    console.log('/projects/entry/variable/set', req.query);
    const { token, entry, variable, value } = req.query;
    if (methods.isToken(token)) {
        // Success
        methods.setProjectEntryVariable(token, entry, variable, value);
        methods.incrementProjectActivity(token);
        methods.writeProjects();
        res.status(200).send();
    } else {
        // Unauthorized
        res.status(401).send();
    }
});

app.get('/projects/entry/datapoint/new', (req, res) => {
    console.log('/projects/entry/datapoint/new', req.query);
    const { token, entry, dataset, value } = req.query;
    if (methods.isToken(token)) {
        // Success
        methods.newProjectEntryDatapoint(token, entry, dataset, value);
        methods.incrementProjectActivity(token);
        methods.writeProjects();
        res.status(200).send();
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