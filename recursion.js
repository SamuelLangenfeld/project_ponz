let childFinder = async(user) => {
  if (user.children.length !== 0) {
    console.log(user);
    //user.populate("children");
    user.children.map(childId => {
      let child = User.findById(childId).populate("children");
      return childFinder(user)
    })
  }
  return user;
}