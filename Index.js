$(document).ready(function () {
    const API_KEY = "e5d5b20447e3a8c23fc6883a2aff9910"; 
    const API_URL = "https://api.themoviedb.org/3";
    const IMG_BASE_URL = "https://image.tmdb.org/t/p/w500";
    const FALLBACK_POSTER = "error.png";


    let currentPage = 1;
    let currentSearchTerm = "";
    let currentGenreId = null;
    let isLoading = false;
    let noMoreResults = false;
    let currentView = 'default';
    let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
    let watchedMovies = JSON.parse(localStorage.getItem('watchedMovies')) || [];

    const $body = $("body");
    const $sidebar = $("#sidebar");
    const $overlay = $("#overlay");
    const $hamburgerBtn = $("#hamburger-menu");
    const $searchInput = $("#search-input");
    const $searchBtn = $("#search-btn");
    const $resultsContainer = $("#results");
    const $browseTitle = $("#browse-title");
    const $loadingIndicator = $("#loading");
    const $endOfResultsMsg = $("#end-of-results");
    const $movieSectionsWrapper = $(".movie-sections-wrapper");
    const $favoritesModalOverlay = $("#favorites-modal-overlay");
    const $favoritesModalContent = $("#favorites-modal-content");
    const $favoritesLoading = $("#favorites-loading");
    const $favoritesEmptyMsg = $favoritesModalContent.find(".empty-favorites-message");
    const $notificationArea = $("#notification-area");

    if (currentView === 'default') {
        fetchSection("trending", `${API_URL}/trending/movie/week?api_key=${API_KEY}`, "Trending This Week");
        fetchSection("popular", `${API_URL}/movie/popular?api_key=${API_KEY}`, "Popular Movies");
        fetchSection("top-rated", `${API_URL}/movie/top_rated?api_key=${API_KEY}`, "Top Rated Movies");
    }

    $hamburgerBtn.on('click', function () {
        const isExpanded = $(this).attr('aria-expanded') === 'true';
        $(this).attr('aria-expanded', !isExpanded);
        $sidebar.toggleClass("open").attr('aria-hidden', isExpanded);
        $overlay.toggleClass("show is-hidden");
    });

    $overlay.on('click', closeSidebar);

    function closeSidebar() {
        $hamburgerBtn.attr('aria-expanded', 'false');
        $sidebar.removeClass("open").attr('aria-hidden', 'true');
        $overlay.addClass("is-hidden").removeClass("show");
    }

    $sidebar.on('click', '.sidebar-button', function() {
        const $button = $(this);
        const buttonId = $button.attr('id');

        if (buttonId === 'refresh-btn') {
            location.reload();
        } else if (buttonId === 'show-favorites-btn') {
            showFavoritesModal();
            closeSidebar();
        } else if (buttonId === 'show-watched-btn') {
            showWatchedMovies();
            closeSidebar();
        } else if ($button.hasClass('genre-btn')) {
            handleGenreClick($button);
            closeSidebar();
        } else if (buttonId === 'cta-btn') {
            console.log("Contact Us clicked");
            showNotification("Contact functionality not implemented yet.", true, 'info');
            closeSidebar();
        }
    });

    function fetchSection(containerId, url, title) {
        const $container = $(`#${containerId}`);
        const $grid = $container.find('.section-grid');
        const $title = $container.find('.section-title');

        $grid.html('<div class="loading-indicator is-hidden"><div class="spinner"></div></div>'); 
        $grid.find('.loading-indicator').removeClass('is-hidden');
        $title.text(title);

        $.getJSON(url)
            .done(function (data) {
                if (data.results && data.results.length > 0) {
                    displayMovieSection(data.results, $grid);
                } else {
                    console.warn(`No results found for ${containerId}`);
                    $grid.html(`<p class='section-empty-message'>No movies found for this section.</p>`);
                }
            })
            .fail(function (jqxhr, textStatus, error) {
                console.error(`Failed to fetch movies for ${containerId}: ${textStatus}, ${error}`);
                $grid.html(`<p class='section-error-message'>Could not load this section.</p>`);
                 showNotification(`Failed to load ${title} section.`, false, 'error');
            })
            .always(function() {
                $grid.find('.loading-indicator').addClass('is-hidden');
            });
    }

    function displayMovieSection(movies, $gridElement) {
        let html = "";
        movies.slice(0, 15).forEach((movie) => {
            html += createMovieCardHtml(movie);
        });
        $gridElement.html(html);
    }

    function createMovieCardHtml(movie) {
        let posterUrl = movie.poster_path ? IMG_BASE_URL + movie.poster_path : FALLBACK_POSTER;
        const title = movie.title || movie.name || "Title not available";
        const year = movie.release_date ? movie.release_date.substring(0, 4) : (movie.first_air_date ? movie.first_air_date.substring(0, 4) : "N/A");
        const movieIdStr = movie.id.toString();
        const isWatched = watchedMovies.includes(movieIdStr);

        const sanitizedTitle = $('<div>').text(title).html();

        return `
            <div class="movie-card ${isWatched ? 'is-watched' : ''}" data-movieid="${movie.id}" tabindex="0">
              <div class="poster-container">
                <img src="${posterUrl}" alt="Poster for ${sanitizedTitle}" class="poster" loading="lazy"/>
                ${isWatched ? '<span class="card-watched-indicator" aria-label="Watched">✔️</span>' : ''}
                <div class="overlay">
                  <h3>${sanitizedTitle}</h3>
                  <p>Year: ${year}</p>
                </div>
              </div>
            </div>`;
    }

    $body.on('click keypress', '.movie-card', function(e) {
         if (e.type === 'click' || (e.type === 'keypress' && (e.which === 13 || e.which === 32))) {
              e.preventDefault();
              handleMovieCardClick($(this));
         }
     });

     function handleMovieCardClick($cardElement) {
         $cardElement.addClass("clicked");
         setTimeout(() => {
             $cardElement.removeClass("clicked");
             const movieId = $cardElement.data("movieid");
             if (movieId) {
                  showMovieDetails(movieId);
             }
         }, 200);
     }


    $searchBtn.on('click', initiateSearch);
    $searchInput.on('keypress', function(e) { if (e.which === 13) { initiateSearch(); } });

    function initiateSearch() {
        currentView = 'search';
        currentPage = 1;
        currentGenreId = null;
        noMoreResults = false;
        $endOfResultsMsg.addClass("is-hidden");
        $browseTitle.addClass("is-hidden");
        $movieSectionsWrapper.addClass("is-hidden");

        const searchTerm = $searchInput.val().trim();
        if (searchTerm === "") {
            resetToDefaultView(); return;
        }
        currentSearchTerm = searchTerm;
        $resultsContainer.empty().removeClass("is-hidden");
        $browseTitle.text(`Search Results for: "${searchTerm}"`).removeClass("is-hidden");
        scrollToElement($browseTitle);
        searchMovies();
    }

    function handleGenreClick($button) {
        const genreName = $button.data("genre");
        const genreIdMap = { Action: 28, Comedy: 35, Drama: 18, Horror: 27, "Sci-Fi": 878, Romance: 10749, Thriller: 53, Animation: 16 };
        const genreId = genreIdMap[genreName];

        if (!genreId) { console.error("Invalid genre:", genreName); return; }

        currentView = 'genre';
        currentPage = 1;
        currentSearchTerm = "";
        currentGenreId = genreId;
        noMoreResults = false;
        $endOfResultsMsg.addClass("is-hidden");
        $searchInput.val('');
        $resultsContainer.empty().removeClass("is-hidden");
        $movieSectionsWrapper.addClass("is-hidden");
        $browseTitle.text(`Browse: ${genreName}`).removeClass("is-hidden");
        scrollToElement($browseTitle);
        searchMovies();
    }

    function showWatchedMovies() {
        currentView = 'watched';
        currentPage = 1;
        currentSearchTerm = "";
        currentGenreId = null;
        noMoreResults = true; 
        $endOfResultsMsg.addClass("is-hidden");
        $searchInput.val('');
        $resultsContainer.empty().removeClass("is-hidden");
        $movieSectionsWrapper.addClass("is-hidden");
        $browseTitle.text("Watched Movies").removeClass("is-hidden");
        scrollToElement($browseTitle);

        if (watchedMovies.length === 0) {
            $resultsContainer.html("<p class='results-empty-message'>You haven't marked any movies as watched yet.</p>");
            $loadingIndicator.addClass("is-hidden");
            return;
        }

        $loadingIndicator.removeClass("is-hidden");

        let promises = watchedMovies.map(movieId => {
            return $.getJSON(`${API_URL}/movie/${movieId}?api_key=${API_KEY}`)
                .fail(function() { console.warn(`Failed fetch watched ID: ${movieId}`); return null; });
        });

        Promise.all(promises).then(movies => {
            let html = '';
            const validMovies = movies.filter(movie => movie !== null);
            if (validMovies.length === 0) {
                $resultsContainer.html("<p class='results-error-message'>Could not load details for watched movies.</p>");
            } else {
                 validMovies.forEach(movie => { html += createMovieCardHtml(movie); });
                 $resultsContainer.html(html); 
            }
        }).catch(error => {
            console.error("Error loading watched movies:", error);
            $resultsContainer.html("<p class='results-error-message'>An error occurred loading watched movies.</p>");
            showNotification("Error loading watched movies.", false, 'error');
        }).finally(() => {
             $loadingIndicator.addClass("is-hidden");
        }); 
    }


    function searchMovies() {
         if (currentView !== 'search' && currentView !== 'genre') { isLoading = false; return; }
         if (isLoading || noMoreResults) return;

         isLoading = true;
         $loadingIndicator.removeClass("is-hidden");
         $endOfResultsMsg.addClass("is-hidden");

         let searchUrl;
         if (currentGenreId) {
             searchUrl = `${API_URL}/discover/movie?api_key=${API_KEY}&with_genres=${currentGenreId}&page=${currentPage}&sort_by=popularity.desc`;
         } else if (currentSearchTerm) {
             searchUrl = `${API_URL}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(currentSearchTerm)}&page=${currentPage}`;
         } else {
             isLoading = false; $loadingIndicator.addClass("is-hidden"); resetToDefaultView(); return;
         }

         $.getJSON(searchUrl)
             .done(function (data) {
                 if (data.results && data.results.length > 0) {
                     displayMovies(data.results);
                     if (currentPage >= data.total_pages) {
                          noMoreResults = true;
                          $endOfResultsMsg.removeClass("is-hidden");
                     }
                 } else {
                     noMoreResults = true;
                     if (currentPage === 1) {
                          $resultsContainer.html("<p class='results-empty-message'>No movies found. Try another search or genre!</p>");
                     } else {
                          $endOfResultsMsg.removeClass("is-hidden");
                     }
                 }
             })
             .fail(function () {
                 console.error("API request failed during search/genre fetch");
                 showNotification("Error fetching movies. Please try again.", false, 'error');
                 if (currentPage === 1) { $resultsContainer.html("<p class='results-error-message'>Could not load results.</p>"); }
                 noMoreResults = true;
             })
             .always(function () { isLoading = false; $loadingIndicator.addClass("is-hidden"); });
    }

    function displayMovies(movies) {
        let html = "";
        movies.forEach((movie) => { html += createMovieCardHtml(movie); });
        $resultsContainer.append(html);
    }

    function resetToDefaultView() {
        currentView = 'default';
        $resultsContainer.empty().addClass("is-hidden");
        $browseTitle.addClass("is-hidden");
        $movieSectionsWrapper.removeClass("is-hidden");
        $searchInput.val('');
        currentSearchTerm = "";
        currentGenreId = null;
        currentPage = 1;
        noMoreResults = false;
        $endOfResultsMsg.addClass("is-hidden");
        $loadingIndicator.addClass("is-hidden");

        $('html, body').animate({ scrollTop: 0 }, 300);
    }

    $(window).on('scroll', function () {
         if ((currentView === 'search' || currentView === 'genre') &&
             !$resultsContainer.hasClass('is-hidden') &&
             $(window).scrollTop() + $(window).height() >= $(document).height() - 350) { 
             if (!isLoading && !noMoreResults) {
                 currentPage++;
                 searchMovies();
             }
         }
    });

    function toggleFavorite(movieId, $buttonElement = null) {
        movieId = movieId.toString();
        const index = favorites.indexOf(movieId);
        let isFavorite;

        if (index === -1) {
            favorites.push(movieId);
            showNotification("Movie added to favorites!", true, 'success');
            isFavorite = true;
        } else {
            favorites.splice(index, 1);
            showNotification("Movie removed from favorites", true, 'error');
            isFavorite = false;
            if ($favoritesModalOverlay.hasClass('show')) {
                const $card = $favoritesModalContent.find(`.movie-card[data-movieid="${movieId}"]`);
                if ($card.length) {
                    $card.fadeOut(300, function() {
                        $(this).remove();
                        if ($favoritesModalContent.find(".movie-card").length === 0) {
                            $favoritesEmptyMsg.removeClass("is-hidden");
                        }
                    });
                }
            }
        }
        localStorage.setItem('favorites', JSON.stringify(favorites));

        const $detailsModalButton = $(`.movie-details-modal .btn-favorite[data-movieid="${movieId}"]`);
        if ($detailsModalButton.length) { updateFavoriteButtonState($detailsModalButton, isFavorite); }
        if ($buttonElement && $buttonElement.length) { updateFavoriteButtonState($buttonElement, isFavorite); }
    }
    function updateFavoriteButtonState($button, isFavorite) {
        $button.toggleClass('is-favorite', isFavorite)
               .html(isFavorite ? '❤️ Remove from Favorites' : '❤️ Add to Favorites');
    }

    function toggleWatched(movieId, $buttonElement = null) {
        movieId = movieId.toString();
        const index = watchedMovies.indexOf(movieId);
        let isWatched;

        if (index === -1) {
            watchedMovies.push(movieId);
            showNotification("Marked as watched!", true, 'success');
            isWatched = true;
        } else {
            watchedMovies.splice(index, 1);
            showNotification("Marked as unwatched", true, 'info');
            isWatched = false;
        }
        localStorage.setItem('watchedMovies', JSON.stringify(watchedMovies));

        const $detailsModalButton = $(`.movie-details-modal .btn-watched[data-movieid="${movieId}"]`);
        if ($detailsModalButton.length) { updateWatchedButtonState($detailsModalButton, isWatched); }
        if ($buttonElement && $buttonElement.length) { updateWatchedButtonState($buttonElement, isWatched); }

        const $movieCard = $(`.movie-card[data-movieid="${movieId}"]`);
        if ($movieCard.length) {
             $movieCard.toggleClass('is-watched', isWatched);
             if (isWatched) {
                 if ($movieCard.find('.card-watched-indicator').length === 0) {
                     $movieCard.find('.poster-container').append('<span class="card-watched-indicator" aria-label="Watched">✔️</span>');
                 }
             } else {
                 $movieCard.find('.card-watched-indicator').remove();
             }
        }

        if (currentView === 'watched' && !isWatched) { showWatchedMovies(); }
    }
    function updateWatchedButtonState($button, isWatched) {
        $button.toggleClass('is-watched', isWatched)
               .html(isWatched ? '✔️ Marked as Watched' : '👁️ Mark as Watched');
    }

    function showFavoritesModal() {
        $favoritesModalContent.find('.movie-card').remove();
        $favoritesLoading.removeClass("is-hidden");
        $favoritesEmptyMsg.addClass("is-hidden");
        $favoritesModalOverlay.removeClass("is-hidden").addClass("show");

        if (favorites.length === 0) {
            $favoritesLoading.addClass("is-hidden");
            $favoritesEmptyMsg.removeClass("is-hidden");
            return;
        }

        let promises = favorites.map(movieId => {
            return $.getJSON(`${API_URL}/movie/${movieId}?api_key=${API_KEY}`)
                .fail(function() { console.warn(`Failed fetch fav ID: ${movieId}`); return null; });
        });

        Promise.all(promises).then(movies => {
            $favoritesLoading.addClass("is-hidden");
            let html = '';
            const validMovies = movies.filter(movie => movie !== null);
            if (validMovies.length === 0) {
                $favoritesEmptyMsg.text(favorites.length > 0 ? "Could not load details." : "No favorites added yet.").removeClass("is-hidden");
            } else {
                 validMovies.forEach(movie => { html += createMovieCardHtml(movie); });
                 $favoritesModalContent.append(html);
            }
        }).catch(error => {
            console.error("Error loading favorites:", error);
            $favoritesLoading.addClass("is-hidden");
            $favoritesEmptyMsg.text("Error loading favorites.").removeClass("is-hidden");
            showNotification("Error loading favorites details.", false, 'error');
        });
    }
    $favoritesModalOverlay.on("click", function (e) {
        if (e.target === this || $(e.target).closest('.close-modal-btn').length) {
            $favoritesModalOverlay.removeClass("show").addClass("is-hidden");
        }
    });


    let notificationTimeout;
    function showNotification(message, autoDismiss = true, type = 'info') {
        clearTimeout(notificationTimeout);
        $notificationArea.find('.notification').remove();
        let borderClass = '';
        if (type === 'success') borderClass = 'success';
        else if (type === 'error') borderClass = 'error';

        const notification = $(`<div class="notification ${borderClass}">${message}</div>`);
        $notificationArea.append(notification);
        setTimeout(() => { notification.addClass('show'); }, 10);

        if (autoDismiss) {
            notificationTimeout = setTimeout(() => {
                 notification.removeClass('show');
                 setTimeout(() => { notification.remove(); }, 500);
            }, 3000);
        }
         notification.on('click', function() {
             clearTimeout(notificationTimeout);
             $(this).removeClass('show');
             setTimeout(() => { $(this).remove(); }, 500);
         });
    }


    function showMovieDetails(movieId) {
        $(".movie-details-modal-overlay").remove(); 

        

        $.getJSON(`${API_URL}/movie/${movieId}?api_key=${API_KEY}&append_to_response=credits,videos`)
            .done(function (data) {
                const movieIdStr = movieId.toString();
                const isFavorite = favorites.includes(movieIdStr);
                const isWatched = watchedMovies.includes(movieIdStr);

                const posterUrl = data.poster_path ? IMG_BASE_URL + data.poster_path : FALLBACK_POSTER;
                const releaseYear = data.release_date ? data.release_date.substring(0, 4) : "N/A";
                const rating = data.vote_average ? data.vote_average.toFixed(1) + " / 10" : "N/A";
                const genres = data.genres ? data.genres.map(g => g.name).join(', ') : 'N/A';
                const overview = data.overview || "Plot summary not available.";
                let trailerKey = null;
                if (data.videos?.results) {
                    const trailer = data.videos.results.find(vid => vid.site === "YouTube" && vid.type === "Trailer") || data.videos.results.find(vid => vid.site === "YouTube");
                    if(trailer) trailerKey = trailer.key;
                }
                let director = "N/A";
                if (data.credits?.crew) {
                    const directorCrew = data.credits.crew.find(person => person.job === "Director");
                    if (directorCrew) director = directorCrew.name;
                }
                const title = $('<div>').text(data.title || 'N/A').html();
                const sanitizedDirector = $('<div>').text(director).html();
                const sanitizedGenres = $('<div>').text(genres).html();
                const sanitizedOverview = $('<div>').text(overview).html();

            
                const modalHTML = `
                    <div class="modal-overlay movie-details-modal-overlay">
                      <div class="modal movie-details-modal" role="dialog" aria-modal="true" aria-labelledby="details-title-${movieId}">
                        <button class="btn-close close-modal-btn" aria-label="Close movie details">×</button>
                        <div class="modal-content">
                          <div class="modal-top-section">
                            <img src="${posterUrl}" alt="Poster for ${title}" class="modal-poster">
                            <div class="modal-title-info">
                              <h2 id="details-title-${movieId}">${title} (${releaseYear})</h2>
                              <p><strong>Director:</strong> ${sanitizedDirector}</p>
                              <p><strong>Rating:</strong> ${rating}</p>
                              <p><strong>Genres:</strong> ${sanitizedGenres}</p>
                              <div class="modal-action-buttons">
                                  <button class="btn btn-favorite" data-movieid="${movieId}"></button>
                                  <button class="btn btn-watched" data-movieid="${movieId}"></button>
                              </div>
                            </div>
                          </div>
                          <div class="modal-plot"> <p><strong>Plot:</strong> ${sanitizedOverview}</p> </div>
                          ${trailerKey ? `<div class="modal-trailer"> <h4>Trailer</h4> <iframe width="100%" height="315" src="https://www.youtube.com/embed/${trailerKey}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe> </div>` : ''}
                        </div>
                      </div>
                    </div>`;

                $body.append(modalHTML);
                const $newModalOverlay = $(".movie-details-modal-overlay");

                updateFavoriteButtonState($newModalOverlay.find('.btn-favorite'), isFavorite);
                updateWatchedButtonState($newModalOverlay.find('.btn-watched'), isWatched);

                setTimeout(() => $newModalOverlay.addClass("show"), 10);

                $newModalOverlay.on("click", function (e) {
                    if (e.target === this || $(e.target).closest('.close-modal-btn').length) {
                        closeAndRemoveDetailsModal($(this));
                    }
                });
                $newModalOverlay.on("click", ".btn-favorite", function() { toggleFavorite(movieId, $(this)); });
                $newModalOverlay.on("click", ".btn-watched", function() { toggleWatched(movieId, $(this)); });

            })
            .fail(function() {
                console.error(`Failed fetch details ID: ${movieId}`);
                showNotification("Could not load movie details.", false, 'error');
            })
    }
     function closeAndRemoveDetailsModal($modalOverlay) {
         $modalOverlay.removeClass("show");
         setTimeout(() => $modalOverlay.remove(), 350);
     }

    function scrollToElement($element) {
         if ($element && $element.length > 0 && !$element.hasClass('is-hidden')) {
             const offsetTop = $element.offset().top;
             const headerHeight = $('.site-header').outerHeight() || 60;
             const scrollTarget = offsetTop - headerHeight - 20;
             $('html, body').animate({ scrollTop: Math.max(0, scrollTarget) }, 500);
         }
     }
                                                        
}); 