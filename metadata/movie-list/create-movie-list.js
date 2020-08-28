const fs = require('fs-extra')
const path = require('path')
let config = JSON.parse(fs.readFileSync('../../config.json', 'utf-8'));

const createCombinedMoviesList = async () => {
    const allMovies = await fs.readJson('./movie-list-combined.json')
    console.log('allMovies', allMovies)
    const movies = { disk1: [], disk2: [], disk3: [] }

    for (let i = 0; i < allMovies.length; i++) {
        const movie = allMovies[i]
        if (i < 20) { // Common movies
            movies.disk1.push(movie)
            movies.disk2.push(movie)
            movies.disk3.push(movie)
        } else if (i < 54) { // Disk 1
            movies.disk1.push(movie)
        } else if (i < 96) { // Disk 2
            movies.disk2.push(movie)
        } else if (i < 106) { // Disk 3
            movies.disk3.push(movie)
        }
    }

    await fs.writeJson(path.join(config.outputMoviesDirectory, 'movies.json'), movies, { spaces: '\t' })
    console.log('movies', movies)

    // config.outputMoviesDirectory
}
createCombinedMoviesList()

// QStringList movie_names_common;
// 		for (int i=0; i<20; ++i) {
// 			movie_names_common.append(movieList[i]);
// 		}

// 		movie_names_cd1.append(movie_names_common);
// 		movie_names_cd2.append(movie_names_common);
// 		movie_names_cd3.append(movie_names_common);
// 		for (int i=20; i<54; ++i) {
// 			movie_names_cd1.append(movieList[i]);
// 		}
// 		for (int i=54; i<96; ++i) {
// 			movie_names_cd2.append(movieList[i]);
// 		}
// 		for (int i=96; i<106; ++i) {
// 			movie_names_cd3.append(movieList[i]);
// 		}
