var categoryNodesArr = [];
var categoryNodesMap = {};
var wrapper;
var focusedElement;
var fuzzySearch;
var currentNodeCount = 0;

var DOWN_KEYCODE = 40;
var UP_KEYCODE = 38;
var CONFIRM_KEYCODE = 13;


function isCategory(node) {
    // a bookmark should have url, otherwise it is category
    return !node.url && node.id > 0;
}

function getParentTitle(node) {
    if (!node) {
        // console.trace('undefined node');
        return '';
    }

    let title = `${node.title} > `;
    if (node.parentId === '0') return '';

    const parentNode = categoryNodesMap[node.parentId];
    if (!parentNode) {
        console.warn('parent node missing: ', node);
    }
    title = getParentTitle(parentNode) + title;
    return title;
}

function filterRecursively(nodeArray, results) {

  results = results || [];

  nodeArray.forEach( function( node ) {
    // save the node if it, then loop into node children
    if (isCategory(node)) {
      categoryNodesArr.push(node)
      categoryNodesMap[node.id] = node;
    }

    if (node.children) {
      filterRecursively(node.children, results);
    }
  });


};

function createUiElement(node) {

  const el = document.createElement("div");
  el.className = 'iw-result'
  el.setAttribute("data-id", node.id);
  el.setAttribute("data-count", node.children.length);
  el.setAttribute("data-title", node.title);

  el.innerHTML = `<span class='iw-parent-title'>${node.parentTitle}</span><span>${node.title}</span>`;

  return el;

}

function triggerClick(element) {

  var categoryId = element.getAttribute("data-id");
  var newCategoryTitle;

  if (categoryId == "NEW") {

    newCategoryTitle = element.getAttribute("data-title");

    chrome.bookmarks.create({
      title: newCategoryTitle
    }, function(res) {
      processBookmark(res.id);
    })

  } else {

    processBookmark(categoryId);

  }

}

function processBookmark(categoryId) {

  getCurrentUrlData(function(url, title) {

    if (title && categoryId && url) {
      addBookmarkToCategory(categoryId, title, url);
      window.close();
    }

  });

}

function addBookmarkToCategory(categoryId, title, url) {

  chrome.bookmarks.create({
    'parentId': categoryId,
    'title': title,
    'url': url
  });

}

function getCurrentUrlData(callbackFn) {

  chrome.tabs.query({'active': true, 'currentWindow': true}, function (tabs) {
    callbackFn(tabs[0].url, tabs[0].title)
  });

}

function createUiFromNodes( categoryNodes ) {
  var categoryUiElements = [];
  currentNodeCount = categoryNodes.length;

  categoryNodes.forEach(function (node) {
      categoryUiElements.push(createUiElement(node));
  });

  categoryUiElements.forEach( function( element ) {
    wrapper.appendChild( element );
  });

};

function resetUi() {

  wrapper.innerHTML = "";

};

function focusItem(index) {

  if (focusedElement) focusedElement.classList.remove("focus");
  focusedElement = wrapper.childNodes[index];
  focusedElement.classList.add("focus");

  focusedElement.scrollIntoView(false);

}

function addCreateCategoryButton(categoryName) {

  var el = document.createElement("div");
  el.className = 'iw-result'
  el.setAttribute("data-id", "NEW");
  el.setAttribute("data-title", categoryName);
  el.classList.add("create");
  el.innerHTML = chrome.i18n.getMessage("new") + ": " + categoryName;

  wrapper.appendChild(el);
  currentNodeCount = currentNodeCount + 1;

}


function createInitialTree() {

  chrome.bookmarks.getTree( function(t) {
      wrapper = document.getElementById('wrapper');

      var options = {
          keys: ['title'],
          threshold: 0.4,
      };

      filterRecursively(t)

      categoryNodesArr.sort(function (a, b) {
          return b.dateGroupModified - a.dateGroupModified;
        });

      categoryNodesArr.forEach(node => {
          node.parentTitle = getParentTitle(categoryNodesMap[node.parentId]);
      });
      delete categoryNodesMap;

      createUiFromNodes(categoryNodesArr);

      wrapper.style.width = wrapper.clientWidth + 'px';

      if (currentNodeCount > 0) focusItem(0);

      fuzzySearch = new Fuse(categoryNodesArr, options);

      wrapper.addEventListener('click', function (e) {
          triggerClick(e.target);
      });
  });

}

(function() {

  var searchElement = document.getElementById("search");
  var text = "";
  var newNodes;
  var index = 0;

  createInitialTree();

  searchElement.addEventListener("keydown", function(e) {

    if (e.code == UP_KEYCODE) {
      e.preventDefault();
      index = index - 1;
      if (index < 0) index = currentNodeCount - 1;
      focusItem(index);

    } else if (e.code == DOWN_KEYCODE) {
      e.preventDefault();
      index = index + 1;
      if (index >= currentNodeCount) index = 0;
      focusItem(index);

    } else if (e.code == CONFIRM_KEYCODE) {
        if (currentNodeCount > 0) triggerClick(focusedElement);
    } else {
      // to get updated input value, we need to schedule it to the next tick
      setTimeout( function() {
        text = document.getElementById("search").value;
        if (text.length) {
          newNodes = fuzzySearch.search(text);
          resetUi();
          createUiFromNodes(newNodes);
          if (newNodes.length) focusItem(0);

          if (!newNodes.length || text !== newNodes[0].title) {
            addCreateCategoryButton(text);
          }

        } else {
          resetUi();
          createUiFromNodes(categoryNodesArr);
          if (currentNodeCount > 0) focusItem(0);
        }
        index = 0;
      }, 0);
    }

  })

  searchElement.focus();

})();