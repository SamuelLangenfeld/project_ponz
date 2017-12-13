// ---------------------------------------------------------
// Recurse Tree
// 2017-12-13 14:46
// ---------------------------------------------------------

let recurseTree = (user) => {
  if (user.children.length === 0) {
    // do nothing
  } else {
    user.children.map(child => {
      let fullChild = await User.findById(child.id);
      if (fullChild.chilren.length > 0) recurseTree(fullChild);
      return fullChild;
    })
  }
}

let buildTree = async () => {
  let tree = {id: null, children: []};
  return recurseTree(tree);
}

